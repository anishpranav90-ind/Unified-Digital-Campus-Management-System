#!/usr/bin/env node
/**
 * RLS verification against a seeded Supabase project.
 *
 *   node --env-file=.env.local scripts/test-rls.mjs
 *
 * Signs in as the three demo roles and asserts that cross-user access is denied
 * by PostgreSQL policies — not by the UI. Exits non-zero if any check fails.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD || "unisync123";

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function signIn(email) {
  const client = createClient(url, key);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Could not sign in as ${email}: ${error.message}`);
    process.exit(1);
  }
  return client;
}

async function main() {
  const admin = await signIn("admin@unisync.edu");
  const student = await signIn("student@unisync.edu");
  const otherStudent = await signIn("priya@unisync.edu");
  const faculty = await signIn("faculty@unisync.edu");
  const anon = createClient(url, key);

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, role");
  if (profilesError) throw profilesError;

  const studentId = profiles.find((p) => p.email === "student@unisync.edu").id;
  const otherId = profiles.find((p) => p.email === "priya@unisync.edu").id;
  check("admin can list all profiles", profiles.length >= 3);
  check(
    "student sees resolved role as student",
    profiles.find((p) => p.id === studentId).role === "student",
  );

  // Print jobs -------------------------------------------------------------
  const { data: ownPrints } = await student.from("print_requests").select("id, student_id");
  check("student reads own print jobs", (ownPrints ?? []).length > 0);
  check(
    "student only sees own print jobs",
    (ownPrints ?? []).every((row) => row.student_id === studentId),
  );

  const { data: otherPrint } = await admin
    .from("print_requests")
    .select("id, student_id")
    .eq("student_id", otherId)
    .limit(1)
    .maybeSingle();
  if (otherPrint) {
    const { data: leaked } = await student.from("print_requests").select("id").eq("id", otherPrint.id);
    check("student cannot read another student's print job", (leaked ?? []).length === 0);
  }

  const { error: forgedPrint } = await student.from("print_requests").insert({
    student_id: otherId,
    document_name: "RLS forgery attempt",
    pages: 1,
    copies: 1,
    color_mode: "bw",
    sides: "single",
  });
  check("student cannot create a print job for someone else", Boolean(forgedPrint), forgedPrint?.message);

  // Maintenance ------------------------------------------------------------
  const { data: otherComplaint } = await admin
    .from("maintenance_requests")
    .select("id, student_id")
    .eq("student_id", otherId)
    .limit(1)
    .maybeSingle();
  if (otherComplaint) {
    const { data: leakedComplaint } = await student
      .from("maintenance_requests")
      .select("id")
      .eq("id", otherComplaint.id);
    check("student cannot read another student's complaint", (leakedComplaint ?? []).length === 0);

    const { data: leakedHistory } = await student
      .from("maintenance_request_history")
      .select("id")
      .eq("request_id", otherComplaint.id);
    check("student cannot read another complaint's history", (leakedHistory ?? []).length === 0);
  }

  // Roles ------------------------------------------------------------------
  const { error: roleChange } = await student
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", studentId);
  check("student cannot self-assign administrator", Boolean(roleChange), roleChange?.message);

  const { data: auditRows } = await student.from("audit_logs").select("id");
  check("student cannot read the audit log", (auditRows ?? []).length === 0);

  // Group isolation --------------------------------------------------------
  const { data: tempGroup, error: groupError } = await faculty
    .from("mentor_groups")
    .insert({
      name: "RLS isolation test group",
      description: "Temporary group created by scripts/test-rls.mjs",
      mentor_id: profiles.find((p) => p.email === "faculty@unisync.edu").id,
    })
    .select("id")
    .single();
  if (groupError) {
    console.error("Could not create test group:", groupError.message);
  } else {
    await faculty.from("mentor_group_members").insert([
      { group_id: tempGroup.id, user_id: profiles.find((p) => p.email === "faculty@unisync.edu").id, member_role: "mentor" },
      { group_id: tempGroup.id, user_id: otherId, member_role: "student" },
    ]);
    await faculty.from("group_messages").insert({
      group_id: tempGroup.id,
      sender_id: profiles.find((p) => p.email === "faculty@unisync.edu").id,
      body: "Private message that unrelated students must not read.",
    });

    const { data: leakedGroups } = await student
      .from("mentor_groups")
      .select("id")
      .eq("id", tempGroup.id);
    check("non-member cannot see the group", (leakedGroups ?? []).length === 0);

    const { data: leakedMessages } = await student
      .from("group_messages")
      .select("id")
      .eq("group_id", tempGroup.id);
    check("non-member cannot read group messages", (leakedMessages ?? []).length === 0);

    const { data: memberMessages } = await otherStudent
      .from("group_messages")
      .select("id")
      .eq("group_id", tempGroup.id);
    check("group member can read group messages", (memberMessages ?? []).length > 0);

    await admin.from("mentor_groups").delete().eq("id", tempGroup.id);
  }

  // Bookmarks (unique constraint) -----------------------------------------
  const { data: opportunity } = await student.from("opportunities").select("id").limit(1).maybeSingle();
  if (opportunity) {
    await student.from("opportunity_bookmarks").delete().eq("opportunity_id", opportunity.id);
    const firstBookmark = await student
      .from("opportunity_bookmarks")
      .insert({ user_id: studentId, opportunity_id: opportunity.id });
    const secondBookmark = await student
      .from("opportunity_bookmarks")
      .insert({ user_id: studentId, opportunity_id: opportunity.id });
    check("bookmark insert succeeds once", !firstBookmark.error, firstBookmark.error?.message);
    check("duplicate bookmark is rejected", Boolean(secondBookmark.error), secondBookmark.error?.message);
    await student.from("opportunity_bookmarks").delete().eq("opportunity_id", opportunity.id);
  }

  // Anonymous access -------------------------------------------------------
  const { data: anonPrint } = await anon.from("print_requests").select("id").limit(1);
  check("anonymous users cannot read print requests", (anonPrint ?? []).length === 0);
  const { data: anonProfiles } = await anon.from("profiles").select("id").limit(1);
  check("anonymous users cannot read profiles", (anonProfiles ?? []).length === 0);

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
