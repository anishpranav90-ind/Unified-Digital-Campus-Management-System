#!/usr/bin/env node
/**
 * Optional deadline reminders.
 *
 *   node --env-file=.env.local scripts/deadline-reminders.mjs
 *
 * Creates in-app notifications for students for opportunities closing within the
 * next three days. Run on a daily schedule (GitHub Actions, cron, or a Supabase
 * Edge Function). Does not send push/email; FCM is an optional module.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const now = new Date();
const inThreeDays = new Date(now);
inThreeDays.setDate(inThreeDays.getDate() + 3);

const { data: opportunities, error } = await admin
  .from("opportunities")
  .select("id, title, organization, deadline")
  .gte("deadline", now.toISOString())
  .lte("deadline", inThreeDays.toISOString());

if (error) {
  console.error(error.message);
  process.exit(1);
}

const { data: students, error: studentError } = await admin
  .from("profiles")
  .select("id")
  .eq("role", "student");

if (studentError) {
  console.error(studentError.message);
  process.exit(1);
}

let created = 0;
for (const opportunity of opportunities ?? []) {
  const existing = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("link", `/opportune/${opportunity.id}`)
    .eq("type", "opportunity")
    .gte("created_at", now.toISOString().slice(0, 10));

  if ((existing.count ?? 0) > 0) continue;

  const rows = (students ?? []).map((student) => ({
    user_id: student.id,
    title: `Deadline in 3 days: ${opportunity.title}`,
    body: `${opportunity.organization} closes on ${new Date(opportunity.deadline).toLocaleDateString("en-IN")}.`,
    link: `/opportune/${opportunity.id}`,
    type: "opportunity",
  }));

  if (rows.length) {
    const { error: insertError } = await admin.from("notifications").insert(rows);
    if (insertError) {
      console.error(insertError.message);
      process.exit(1);
    }
    created += rows.length;
  }
}

console.log(`Created ${created} deadline reminder(s) for ${(opportunities ?? []).length} opportunity(ies).`);
