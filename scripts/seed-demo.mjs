#!/usr/bin/env node
/**
 * Seed the UniSync demo dataset into a Supabase project.
 *
 *   node --env-file=.env.local scripts/seed-demo.mjs --reset
 *
 * Two transports are supported, so the script works with whichever credential
 * the project has to hand:
 *
 *   SUPABASE_SERVICE_ROLE_KEY  Supabase-js admin client (auth admin API + PostgREST)
 *   SUPABASE_DB_URL            direct Postgres connection (session pooler or direct)
 *
 * The service-role key or database password is used only by this local script;
 * never ship either to a browser.
 *
 * Accounts created (password: unisync123):
 *   student@unisync.edu  student
 *   faculty@unisync.edu  faculty / mentor
 *   admin@unisync.edu    administrator
 *   priya@unisync.edu, kabir@unisync.edu, ananya@unisync.edu,
 *   rohan@unisync.edu, sanjay@unisync.edu
 */

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { CLEAR_ORDER, PASSWORD, PEOPLE, buildDemoDataset } from "./demo-dataset.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DB_URL;
const reset = process.argv.includes("--reset");

if (!url) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}
if (!serviceKey && !databaseUrl) {
  console.error(
    "Set either SUPABASE_SERVICE_ROLE_KEY (Supabase admin API) or SUPABASE_DB_URL (direct Postgres).\n" +
      "Then run: node --env-file=.env.local scripts/seed-demo.mjs --reset",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

function supabaseTransport() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function listUsers() {
    const users = [];
    for (let page = 1; page < 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      users.push(...data.users);
      if (data.users.length < 100) break;
    }
    return users;
  }

  return {
    label: "service-role key",
    async ensureUsers(people) {
      const existing = await listUsers();
      const ids = {};
      for (const person of people) {
        let user = existing.find((item) => item.email?.toLowerCase() === person.email.toLowerCase());
        if (user) {
          const { data, error } = await admin.auth.admin.updateUserById(user.id, {
            email_confirm: true,
            password: PASSWORD,
          });
          if (error) throw new Error(`Could not update ${person.email}: ${error.message}`);
          user = data.user;
        } else {
          const { data, error } = await admin.auth.admin.createUser({
            email: person.email,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: person.full_name, roll_number: person.roll },
          });
          if (error) throw new Error(`Could not create ${person.email}: ${error.message}`);
          user = data.user;
        }
        ids[person.key] = user.id;
      }
      return ids;
    },
    async count(table) {
      const { count, error } = await admin.from(table).select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    async clear() {
      for (const [table, column] of CLEAR_ORDER) {
        const { error } = await admin.from(table).delete().not(column, "is", null);
        if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
      }
    },
    async pricedPrints() {
      const { count, error } = await admin
        .from("print_requests")
        .select("id", { count: "exact", head: true })
        .gt("estimated_cost", 0);
      if (error) throw error;
      return count ?? 0;
    },
    async write(table, rows, onConflict) {
      const { error } = onConflict
        ? await admin.from(table).upsert(rows, { onConflict })
        : await admin.from(table).insert(rows);
      if (error) throw new Error(`${table}: ${error.message}`);
      return rows.length;
    },
    async close() {},
  };
}

function postgresTransport() {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  function quote(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  return {
    label: "direct Postgres connection",
    async connect() {
      await client.connect();
      // The seeding guards in the migrations trust the service-role claim; a
      // direct session has no JWT, so set the claim explicitly.
      await client.query("select set_config('request.jwt.claim.role', 'service_role', false)");
      await client.query(
        `select set_config('request.jwt.claims', '{"role":"service_role"}', false)`,
      );
    },
    async ensureUsers(people) {
      const ids = {};
      for (const person of people) {
        const meta = JSON.stringify({
          sub: undefined,
          full_name: person.full_name,
          roll_number: person.roll,
        });
        const { rows: existing } = await client.query("select id from auth.users where email = $1", [
          person.email,
        ]);
        let userId = existing[0]?.id;
        if (userId) {
          await client.query(
            `update auth.users
                set encrypted_password = crypt($2, gen_salt('bf', 10)),
                    email_confirmed_at = now(),
                    confirmation_token = coalesce(confirmation_token, ''),
                    recovery_token = coalesce(recovery_token, ''),
                    email_change_token_new = coalesce(email_change_token_new, ''),
                    email_change = coalesce(email_change, ''),
                    updated_at = now()
              where id = $1`,
            [userId, PASSWORD],
          );
        } else {
          const { rows } = await client.query(
            // GoTrue scans the token columns into strings, so they must be ''
            // rather than NULL or every sign-in fails with "Database error
            // querying schema".
            `insert into auth.users (
               instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
               raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
               confirmation_token, recovery_token, email_change_token_new, email_change,
               email_change_token_current, reauthentication_token, phone_change, phone_change_token,
               is_sso_user, is_anonymous
             ) values (
               '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
               $1, crypt($2, gen_salt('bf', 10)), now(),
               '{"provider":"email","providers":["email"]}', $3::jsonb, now(), now(),
               '', '', '', '', '', '', '', '', false, false
             )
             returning id`,
            [person.email, PASSWORD, meta],
          );
          userId = rows[0].id;
        }
        const { rows: identity } = await client.query(
          "select id from auth.identities where user_id = $1 and provider = 'email'",
          [userId],
        );
        if (identity.length === 0) {
          // auth.identities.email is a generated column derived from identity_data.
          await client.query(
            `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
             values ($1, $2, $3::jsonb, 'email', now(), now(), now())`,
            [
              userId,
              userId,
              JSON.stringify({ sub: userId, email: person.email, email_verified: true, phone_verified: false }),
            ],
          );
        }
        ids[person.key] = userId;
      }
      return ids;
    },
    async count(table) {
      const { rows } = await client.query(`select count(*)::int as n from ${quote(table)}`);
      return rows[0].n;
    },
    async clear() {
      for (const [table, column] of CLEAR_ORDER) {
        await client.query(`delete from ${quote(table)} where ${quote(column)} is not null`);
      }
    },
    async pricedPrints() {
      const { rows } = await client.query(
        "select count(*)::int as n from print_requests where estimated_cost > 0",
      );
      return rows[0].n;
    },
    async write(table, rows, onConflict) {
      if (rows.length === 0) return 0;
      // Group rows that share an identical column set, so omitted columns keep
      // their database defaults instead of being inserted as explicit NULLs.
      const groups = new Map();
      for (const row of rows) {
        const columns = Object.keys(row).sort();
        const key = columns.join("|");
        if (!groups.has(key)) groups.set(key, { columns, rows: [] });
        groups.get(key).rows.push(row);
      }

      let written = 0;
      for (const { columns, rows: groupRows } of groups.values()) {
        for (let start = 0; start < groupRows.length; start += 200) {
          const chunk = groupRows.slice(start, start + 200);
          const values = [];
          const tuples = chunk.map((row, rowIndex) => {
            const placeholders = columns.map((column, columnIndex) => {
              values.push(row[column]);
              return `$${rowIndex * columns.length + columnIndex + 1}`;
            });
            return `(${placeholders.join(", ")})`;
          });
          const conflict = onConflict
            ? `on conflict (${quote(onConflict)}) do update set ${columns
                .filter((column) => column !== onConflict && column !== "id")
                .map((column) => `${quote(column)} = excluded.${quote(column)}`)
                .join(", ")}`
            : "";
          await client.query(
            `insert into ${quote(table)} (${columns.map(quote).join(", ")}) values ${tuples.join(", ")} ${conflict}`,
            values,
          );
          written += chunk.length;
        }
      }
      return written;
    },
    async close() {
      await client.end();
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const transport = databaseUrl && !serviceKey ? postgresTransport() : supabaseTransport();
  console.log(`Seeding UniSync demo data into ${url} via ${transport.label}`);

  if (transport.connect) await transport.connect();

  const existing = await transport.count("opportunities");
  if (existing > 0 && !reset) {
    console.log("Demo data already present. Re-run with --reset to replace it.");
    await transport.close();
    return;
  }
  if (reset) {
    await transport.clear();
    console.log("✓ cleared previous demo data");
  }

  const users = await transport.ensureUsers(PEOPLE);
  console.log(`✓ ${PEOPLE.length} demo auth users (password: ${PASSWORD})`);

  const dataset = buildDemoDataset({ users });
  await transport.write("profiles", dataset.profiles, "id");
  console.log("✓ profiles & roles");

  for (const step of dataset.steps) {
    const written = await transport.write(step.table, step.rows, step.onConflict);
    console.log(`✓ ${step.table} (${written})`);
  }

  const priced = await transport.pricedPrints();
  if (priced > 0) {
    console.log("✓ database-side print pricing applied");
  } else {
    console.warn("Warning: estimated_cost was not priced by the database trigger. Check print_queue_settings.");
  }

  await transport.close();
  console.log("\nUniSync demo data seeded.");
  console.log("Sign in with student@unisync.edu / faculty@unisync.edu / admin@unisync.edu");
  console.log(`Password for all demo accounts: ${PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
