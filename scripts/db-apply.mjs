#!/usr/bin/env node
/**
 * Apply the UniSync SQL migrations and the reference seed to a Postgres database.
 *
 *   node --env-file=.env.local scripts/db-apply.mjs            # apply pending
 *   node --env-file=.env.local scripts/db-apply.mjs --status   # show what is applied
 *   node --env-file=.env.local scripts/db-apply.mjs --seed     # apply pending + seed.sql
 *
 * Uses SUPABASE_DB_URL (session pooler or direct connection string) and records
 * applied files in supabase_migrations.schema_migrations, the same table the
 * Supabase CLI uses, so `supabase db push` and this script can be mixed.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const databaseUrl = process.env.SUPABASE_DB_URL;
if (!databaseUrl) {
  console.error("Set SUPABASE_DB_URL to a Postgres connection string (see .env.example).");
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const seedFile = path.join(root, "supabase", "seed.sql");
const args = new Set(process.argv.slice(2));

const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function appliedVersions() {
  const { rows } = await client.query("select version from supabase_migrations.schema_migrations");
  return new Set(rows.map((row) => row.version));
}

async function main() {
  await client.connect();
  await client.query("create schema if not exists supabase_migrations");
  await client.query(`
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      name text,
      statements text[],
      inserted_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  const done = await appliedVersions();
  const pending = files.filter((file) => !done.has(file.split("_")[0]));

  if (args.has("--status")) {
    for (const file of files) {
      console.log(`${done.has(file.split("_")[0]) ? "applied" : "pending"}  ${file}`);
    }
    return;
  }

  if (pending.length === 0) {
    console.log("No pending migrations.");
  }

  for (const file of pending) {
    const version = file.split("_")[0];
    const name = file.replace(/^\d+_/, "").replace(/\.sql$/, "");
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    process.stdout.write(`applying ${file} … `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)", [
        version,
        name,
      ]);
      await client.query("commit");
      console.log("done");
    } catch (error) {
      await client.query("rollback").catch(() => {});
      console.error(`failed\n  ${error.code ?? ""} ${error.message}`.trim());
      if (error.position) {
        const line = sql.slice(0, Number(error.position)).split("\n").length;
        console.error(`  near line ${line} of ${file}`);
      }
      process.exitCode = 1;
      return;
    }
  }

  if (args.has("--seed")) {
    const sql = await readFile(seedFile, "utf8");
    process.stdout.write("applying supabase/seed.sql … ");
    await client.query(sql);
    console.log("done");
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end().catch(() => {}));
