#!/usr/bin/env node
/**
 * Seed realistic UniSync demo data into a linked Supabase project.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-demo.mjs --reset
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * The service-role key is only used by this local script; never ship it to a browser.
 *
 * Accounts created (password: unisync123):
 *   student@unisync.edu  student
 *   faculty@unisync.edu  faculty / mentor
 *   admin@unisync.edu    administrator
 *   priya@unisync.edu, kabir@unisync.edu, ananya@unisync.edu,
 *   rohan@unisync.edu, sanjay@unisync.edu
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD || "unisync123";

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add them to .env.local and run with: node --env-file=.env.local scripts/seed-demo.mjs --reset",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const reset = process.argv.includes("--reset");
const now = new Date();
const iso = (date) => date.toISOString();
const days = (n, hours = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + n);
  date.setHours(date.getHours() + hours);
  return iso(date);
};
const dateOnly = (n) => days(n).slice(0, 10);

const DEPTS = {
  cse: "44444444-4444-4444-8444-444444444401",
  ece: "44444444-4444-4444-8444-444444444402",
};

const PEOPLE = [
  { key: "student", email: "student@unisync.edu", full_name: "Aarav Sharma", role: "student", dept: DEPTS.cse, semester: 5, roll: "CS22B001", interests: ["hackathon", "internship", "workshop"] },
  { key: "priya", email: "priya@unisync.edu", full_name: "Priya Nair", role: "student", dept: DEPTS.cse, semester: 5, roll: "CS22B014", interests: ["internship", "placement", "seminar"] },
  { key: "kabir", email: "kabir@unisync.edu", full_name: "Kabir Verma", role: "student", dept: DEPTS.ece, semester: 3, roll: "EC23B022", interests: ["technical_event", "competition"] },
  { key: "ananya", email: "ananya@unisync.edu", full_name: "Ananya Rao", role: "student", dept: DEPTS.cse, semester: 5, roll: "CS22B007", interests: ["hackathon", "scholarship"] },
  { key: "meera", email: "faculty@unisync.edu", full_name: "Dr. Meera Iyer", role: "faculty", dept: DEPTS.cse, semester: null, roll: null, interests: [] },
  { key: "rohan", email: "rohan@unisync.edu", full_name: "Prof. Rohan Desai", role: "faculty", dept: DEPTS.cse, semester: null, roll: null, interests: [] },
  { key: "sanjay", email: "sanjay@unisync.edu", full_name: "Dr. Sanjay Kulkarni", role: "faculty", dept: DEPTS.ece, semester: null, roll: null, interests: [] },
  { key: "admin", email: "admin@unisync.edu", full_name: "Kavita Menon", role: "admin", dept: null, semester: null, roll: null, interests: [] },
];

function check(result, label) {
  if (result.error) {
    console.error(`✗ ${label}: ${result.error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${label}`);
  return result.data;
}

async function listAllUsers() {
  const users = [];
  let page = 1;
  while (page < 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 100) break;
    page += 1;
  }
  return users;
}

async function main() {
  console.log(`Seeding UniSync demo data into ${url}`);

  check(
    await admin.from("departments").upsert(
      [
        { id: DEPTS.cse, name: "Computer Science & Engineering", code: "CSE" },
        { id: DEPTS.ece, name: "Electronics & Communication", code: "ECE" },
      ],
      { onConflict: "code" },
    ),
    "departments",
  );

  const existing = await admin.from("opportunities").select("id", { count: "exact", head: true });
  if (existing.error) throw existing.error;
  if ((existing.count ?? 0) > 0 && !reset) {
    console.log("Demo data already present. Re-run with --reset to replace it.");
    return;
  }

  if (reset) {
    const clearOrder = [
      ["audit_logs", "id"],
      ["notifications", "id"],
      ["maintenance_comments", "id"],
      ["maintenance_request_history", "id"],
      ["maintenance_requests", "id"],
      ["opportunity_bookmarks", "user_id"],
      ["opportunities", "id"],
      ["message_attachments", "id"],
      ["group_messages", "id"],
      ["mentor_group_members", "user_id"],
      ["mentor_groups", "id"],
      ["print_requests", "id"],
      ["timetable_correction_requests", "id"],
      ["exam_schedules", "id"],
      ["timetable_entries", "id"],
      ["subjects", "id"],
      ["classrooms", "id"],
      ["announcement_reads", "user_id"],
      ["announcements", "id"],
    ];
    for (const [table, column] of clearOrder) {
      const { error } = await admin.from(table).delete().not(column, "is", null);
      if (error) {
        console.error(`Could not clear ${table}: ${error.message}`);
        process.exit(1);
      }
    }
    console.log("✓ cleared previous demo data");
  }

  const users = await listAllUsers();
  const userIds = {};
  for (const person of PEOPLE) {
    let user = users.find((item) => item.email?.toLowerCase() === person.email.toLowerCase());
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: person.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: person.full_name, roll_number: person.roll },
      });
      if (error) {
        console.error(`Could not create ${person.email}: ${error.message}`);
        process.exit(1);
      }
      user = data.user;
      console.log(`✓ created auth user ${person.email}`);
    }
    userIds[person.key] = user.id;

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: user.id,
        full_name: person.full_name,
        email: person.email,
        role: person.role,
        department_id: person.dept,
        semester: person.semester,
        roll_number: person.roll,
        interests: person.interests,
        updated_at: iso(now),
      },
      { onConflict: "id" },
    );
    if (profileError) {
      console.error(`Could not upsert profile for ${person.email}: ${profileError.message}`);
      process.exit(1);
    }
  }
  console.log("✓ profiles & roles");

  check(
    await admin.from("print_queue_settings").upsert(
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        bw_single: 2,
        bw_double: 3,
        color_single: 5,
        color_double: 8,
        avg_processing_minutes: 4,
        max_pages_per_job: 100,
        printer_mode: "simulated",
      },
      { onConflict: "id" },
    ),
    "print settings",
  );

  const subjects = check(
    await admin
      .from("subjects")
      .insert([
        { name: "Database Management Systems", code: "CS501", department_id: DEPTS.cse, semester: 5, color: "#2563eb" },
        { name: "Operating Systems", code: "CS502", department_id: DEPTS.cse, semester: 5, color: "#14b8a6" },
        { name: "Computer Networks", code: "CS503", department_id: DEPTS.cse, semester: 5, color: "#f97316" },
        { name: "Software Engineering", code: "CS504", department_id: DEPTS.cse, semester: 5, color: "#8b5cf6" },
        { name: "Cloud Computing", code: "CS505", department_id: DEPTS.cse, semester: 5, color: "#ec4899" },
        { name: "Data Structures", code: "CS301", department_id: DEPTS.cse, semester: 3, color: "#0ea5e9" },
        { name: "Digital Circuits", code: "EC301", department_id: DEPTS.ece, semester: 3, color: "#22c55e" },
      ])
      .select("*"),
    "subjects",
  );

  const rooms = check(
    await admin
      .from("classrooms")
      .insert([
        { name: "C-101", building: "CSE Block", capacity: 60 },
        { name: "C-102", building: "CSE Block", capacity: 60 },
        { name: "Lab-1", building: "CSE Block", capacity: 40 },
        { name: "Lab-2", building: "CSE Block", capacity: 40 },
        { name: "A-201", building: "Main Block", capacity: 80 },
        { name: "Seminar Hall", building: "Main Block", capacity: 120 },
      ])
      .select("*"),
    "classrooms",
  );

  const subjectId = (code) => subjects.find((subject) => subject.code === code).id;
  const roomId = (name) => rooms.find((room) => room.name === name).id;
  const slot = (subject, faculty, room, day, start, end, section = "A", semester = 5) => ({
    subject_id: subjectId(subject),
    faculty_id: userIds[faculty],
    classroom_id: roomId(room),
    day_of_week: day,
    start_time: start,
    end_time: end,
    semester,
    section,
    academic_year: "2026-27",
    published: true,
  });

  check(
    await admin.from("timetable_entries").insert([
      slot("CS501", "meera", "C-101", 1, "09:00", "10:00"),
      slot("CS502", "meera", "C-101", 1, "10:15", "11:15"),
      slot("CS503", "rohan", "C-102", 1, "11:30", "12:30"),
      slot("CS504", "rohan", "C-102", 1, "14:00", "15:00"),
      slot("CS501", "meera", "Lab-1", 1, "15:15", "17:15"),
      slot("CS501", "meera", "C-101", 2, "09:00", "10:00"),
      slot("CS505", "rohan", "Seminar Hall", 2, "10:15", "11:15"),
      slot("CS503", "rohan", "C-102", 2, "11:30", "12:30"),
      slot("CS502", "meera", "Lab-2", 2, "14:00", "16:00"),
      slot("CS504", "rohan", "C-101", 3, "09:00", "10:00"),
      slot("CS503", "rohan", "C-102", 3, "10:15", "11:15"),
      slot("CS501", "meera", "C-101", 3, "11:30", "12:30"),
      slot("CS505", "rohan", "Seminar Hall", 4, "09:00", "10:00"),
      slot("CS502", "meera", "C-101", 4, "10:15", "11:15"),
      slot("CS504", "rohan", "Lab-1", 4, "14:00", "16:00"),
      slot("CS501", "meera", "Lab-1", 5, "09:00", "11:00"),
      slot("CS505", "rohan", "C-102", 5, "11:30", "12:30"),
      slot("CS301", "sanjay", "A-201", 3, "09:00", "10:00", "ECE-A", 3),
      slot("EC301", "sanjay", "A-201", 4, "11:30", "12:30", "ECE-A", 3),
    ]),
    "timetable",
  );

  check(
    await admin.from("exam_schedules").insert([
      { subject_id: subjectId("CS501"), exam_date: dateOnly(5), start_time: "09:30", end_time: "11:30", room: "A-201", exam_type: "midterm", semester: 5 },
      { subject_id: subjectId("CS502"), exam_date: dateOnly(8), start_time: "09:30", end_time: "11:30", room: "C-101", exam_type: "midterm", semester: 5 },
      { subject_id: subjectId("CS503"), exam_date: dateOnly(12), start_time: "14:00", end_time: "16:00", room: "Seminar Hall", exam_type: "end_semester", semester: 5 },
    ]),
    "exams",
  );

  check(
    await admin.from("announcements").insert([
      {
        title: "Mid-semester examination timetable published",
        body: "The mid-semester examination timetable for all departments is now available in TimeGrid. Examinations begin next week. Students must carry their college ID and hall ticket to every exam.",
        category: "exam", audience: "all", author_id: userIds.admin, published_at: days(0, -3),
      },
      {
        title: "Library extends weekend hours",
        body: "The central library will remain open until 9 PM on Saturdays and Sundays through the examination period. Reading rooms on the second floor are available for group study.",
        category: "general", audience: "all", author_id: userIds.admin, published_at: days(-1, -2),
      },
      {
        title: "DBMS lab rescheduled to Friday",
        body: "This week's CS501 database lab has moved from Thursday 2 PM to Friday 9 AM in Lab-1. Please complete the normalisation assignment before the session.",
        category: "academic", audience: "students", author_id: userIds.meera, published_at: days(-1, -5),
      },
      {
        title: "Scholarship applications close in 10 days",
        body: "The Reliance Foundation undergraduate scholarship applications close in 10 days. Eligible students should review the opportunity in Opportune and apply before the deadline.",
        category: "general", audience: "students", author_id: userIds.meera, published_at: days(-2),
      },
    ]),
    "announcements",
  );

  const prints = check(
    await admin
      .from("print_requests")
      .insert([
        { student_id: userIds.student, document_name: "DBMS Unit 3 — Normalisation Notes", pages: 12, page_range: "1-12", copies: 1, color_mode: "bw", sides: "double", status: "queued", created_at: days(0, 0, -22), updated_at: days(0, 0, -18), notes: "Need before the 2 PM lab." },
        { student_id: userIds.student, document_name: "Aarav Sharma — Resume 2026", pages: 2, page_range: "1-2", copies: 3, color_mode: "bw", sides: "single", status: "ready", created_at: days(0, -2, -10), updated_at: days(0, -1, -30) },
        { student_id: userIds.student, document_name: "OS Lab Record — Sem 5", pages: 30, copies: 1, color_mode: "bw", sides: "double", status: "completed", created_at: days(-1, -3), updated_at: days(-1, -1) },
        { student_id: userIds.priya, document_name: "Placement Portfolio", pages: 8, page_range: "1-8", copies: 2, color_mode: "color", sides: "single", status: "queued", payment_status: "unpaid", payment_method: "desk", created_at: days(0, 0, -12) },
        { student_id: userIds.kabir, document_name: "Digital Circuits Assignment 2", pages: 6, copies: 1, color_mode: "bw", sides: "single", status: "processing", priority: "urgent", created_at: days(0, 0, -30) },
      ])
      .select("*"),
    "print requests",
  );
  if (prints.some((request) => Number(request.estimated_cost) <= 0)) {
    console.warn("Warning: estimated_cost was not priced by the database trigger. Check print_queue_settings.");
  } else {
    console.log("✓ database-side print pricing applied");
  }

  const meetGroup = check(
    await admin.from("mentor_groups").insert({ name: "DBMS Doubt Clearing", description: "Weekly doubt-clearing group for CS501. Post questions before Friday labs.", mentor_id: userIds.meera, department_id: DEPTS.cse }).select("*").single(),
    "mentor group (DBMS)",
  );
  const placementGroup = check(
    await admin.from("mentor_groups").insert({ name: "Placement Prep Circle", description: "Aptitude, DSA and mock interviews for the upcoming placement season.", mentor_id: userIds.rohan, department_id: DEPTS.cse }).select("*").single(),
    "mentor group (Placement)",
  );

  check(
    await admin.from("mentor_group_members").insert([
      { group_id: meetGroup.id, user_id: userIds.meera, member_role: "mentor", last_read_at: days(0, -1) },
      { group_id: meetGroup.id, user_id: userIds.student, member_role: "student", last_read_at: days(-1) },
      { group_id: meetGroup.id, user_id: userIds.priya, member_role: "student", last_read_at: days(0, -3) },
      { group_id: meetGroup.id, user_id: userIds.ananya, member_role: "student", last_read_at: days(0, -1) },
      { group_id: placementGroup.id, user_id: userIds.rohan, member_role: "mentor", last_read_at: days(0, -2) },
      { group_id: placementGroup.id, user_id: userIds.student, member_role: "student", last_read_at: days(0, -30) },
      { group_id: placementGroup.id, user_id: userIds.priya, member_role: "student", last_read_at: days(0, -1) },
    ]),
    "group members",
  );

  check(
    await admin.from("group_messages").insert([
      { group_id: meetGroup.id, sender_id: userIds.meera, body: "Reminder: the normalisation assignment is due Friday. Bring your ER diagrams to the lab.", created_at: days(-1, -3) },
      { group_id: meetGroup.id, sender_id: userIds.priya, body: "Ma'am, can we use the 3NF decomposition from Wednesday's lecture for question 4?", created_at: days(-1, -2) },
      { group_id: meetGroup.id, sender_id: userIds.meera, body: "Yes. Show both the original and decomposed schemas so the steps are clear.", created_at: days(0, -4) },
      { group_id: meetGroup.id, sender_id: userIds.ananya, body: "Sharing my notes from today's class. Chapter 7 starts at page 12.", created_at: days(0, -2) },
      { group_id: meetGroup.id, sender_id: userIds.student, body: "Thanks Ananya! I had one question about BCNF vs 3NF — can we discuss it after the lab?", created_at: days(0, -1) },
      { group_id: placementGroup.id, sender_id: userIds.rohan, body: "Mock aptitude test this Saturday at 10 AM in Lab-1. Attempt the full 60 minutes without breaks.", created_at: days(0, -5) },
      { group_id: placementGroup.id, sender_id: userIds.student, body: "Count me in. Should we bring our own laptops?", created_at: days(0, -4) },
      { group_id: placementGroup.id, sender_id: userIds.rohan, body: "Yes, laptops please. I'll share the test link at the start.", created_at: days(0, -3) },
    ]),
    "group messages",
  );

  const opportunities = check(
    await admin
      .from("opportunities")
      .insert([
        { title: "Smart India Hackathon 2026", organization: "Ministry of Education, Govt. of India", category: "hackathon", description: "A nationwide 36-hour innovation challenge across software and hardware problem statements. Teams build a working prototype and pitch to a jury.", eligibility: "All undergraduate students. Teams of 4–6.", location: "Bengaluru", mode: "offline", deadline: days(18), event_start: days(32), event_end: days(34), apply_url: "https://www.sih.gov.in/", tags: ["innovation", "team", "prototype"], posted_by: userIds.rohan },
        { title: "Frontend Engineering Intern", organization: "Zoho Corporation", category: "internship", description: "Six-month internship on the Zoho Creator frontend team. Work with React and TypeScript on production UI.", eligibility: "Pre-final and final year CSE/IT students with a strong React portfolio.", location: "Chennai", mode: "hybrid", deadline: days(9), event_start: days(20), apply_url: "https://www.zoho.com/careers/", tags: ["react", "typescript", "frontend"], posted_by: userIds.meera },
        { title: "Cloud Fundamentals Workshop", organization: "AWS Academy × UniSync", category: "workshop", description: "Hands-on workshop covering IAM, S3, Lambda and cost-safe deployments. Bring a laptop.", eligibility: "Open to all students; basic networking knowledge recommended.", location: "Seminar Hall", mode: "offline", deadline: days(4), event_start: days(6), event_end: days(6), apply_url: "https://aws.amazon.com/training/", tags: ["cloud", "aws"], posted_by: userIds.rohan },
        { title: "Graduate Software Engineer — 2027", organization: "Microsoft India", category: "placement", description: "Campus hiring for full-time software engineering roles. Online assessment followed by technical interviews.", eligibility: "Final year students with 7.0+ CGPA and no active backlogs.", location: "Hyderabad / Noida", mode: "hybrid", deadline: days(14), event_start: days(24), apply_url: "https://careers.microsoft.com/", tags: ["full-time", "dsa"], posted_by: userIds.admin },
        { title: "Reliance Foundation Undergraduate Scholarship", organization: "Reliance Foundation", category: "scholarship", description: "Merit-cum-means scholarship covering tuition support and mentoring for undergraduate students.", eligibility: "First-year to final-year undergraduates with family income below ₹15 lakh.", location: "India", mode: "online", deadline: days(26), apply_url: "https://www.reliancefoundation.org/scholarships", tags: ["scholarship"], posted_by: userIds.meera },
        { title: "IEEE Technical Paper Competition", organization: "IEEE Student Branch", category: "competition", description: "Present original research or a technical review paper. Shortlisted teams present at the regional congress.", eligibility: "Teams of up to 3 students.", location: "Pune", mode: "offline", deadline: days(11), event_start: days(28), event_end: days(29), apply_url: "https://www.ieee.org/", tags: ["research", "paper"], posted_by: userIds.sanjay },
        { title: "AI for Bharat Seminar", organization: "IIT Bombay — AI Centre", category: "seminar", description: "A half-day seminar on applied AI for public infrastructure, with demos from research labs.", eligibility: "Open to all students and faculty.", location: "Online", mode: "online", deadline: days(7), event_start: days(13), event_end: days(13), apply_url: "https://www.iitb.ac.in/", tags: ["ai", "seminar"], posted_by: userIds.admin },
        { title: "CodeSprint Campus Challenge", organization: "UniSync Coding Club", category: "technical_event", description: "A three-round competitive programming sprint with prizes for the top ten coders.", eligibility: "All UG students. Individual participation.", location: "Lab-1 & Lab-2", mode: "offline", deadline: days(3), event_start: days(10), event_end: days(10), apply_url: "https://codeforces.com/", tags: ["competitive programming"], posted_by: userIds.rohan },
      ])
      .select("id, title"),
    "opportunities",
  );

  await admin.from("opportunity_bookmarks").insert([
    { user_id: userIds.student, opportunity_id: opportunities[0].id },
    { user_id: userIds.student, opportunity_id: opportunities[1].id },
  ]);

  const complaints = check(
    await admin
      .from("maintenance_requests")
      .insert([
        { student_id: userIds.student, title: "Projector not powering on in C-102", description: "The ceiling projector in C-102 does not power on. The indicator light stays red and the remote has no effect. This is blocking the Friday DBMS presentation.", category: "Broken classroom equipment", building: "CSE Block", room: "C-102", priority: "high", status: "in_progress", assigned_to: userIds.meera, created_at: days(-2), updated_at: days(0, -3) },
        { student_id: userIds.student, title: "Water leakage near first-floor washroom", description: "Water is seeping from the ceiling outside the Main Block washroom and pooling near the stairs.", category: "Water leakage", building: "Main Block", room: "1st floor, near washroom", priority: "urgent", status: "submitted", created_at: days(0, -4) },
        { student_id: userIds.priya, title: "Flickering tube light in C-101", description: "The second tube light near the window flickers constantly and makes a buzzing sound.", category: "Electrical issue", building: "CSE Block", room: "C-101", priority: "low", status: "under_review", created_at: days(-1) },
        { student_id: userIds.kabir, title: "Oscilloscope in Electronics Lab not calibrating", description: "Channel 2 of the Tektronix oscilloscope shows a constant offset and will not calibrate. Lab practicals are affected.", category: "Laboratory equipment", building: "Science Block", room: "Electronics Lab", priority: "high", status: "assigned", assigned_to: userIds.sanjay, created_at: days(-4) },
      ])
      .select("*"),
    "complaints",
  );

  await admin.from("maintenance_request_history").insert([
    { request_id: complaints[0].id, status: "submitted", note: "Complaint submitted by student.", changed_by: userIds.student, created_at: days(-2) },
    { request_id: complaints[0].id, status: "under_review", note: "Facilities team is checking the projector inventory.", changed_by: userIds.admin, created_at: days(-1, -6) },
    { request_id: complaints[0].id, status: "assigned", note: "Assigned to Dr. Meera Iyer.", changed_by: userIds.admin, created_at: days(-1, -2) },
    { request_id: complaints[0].id, status: "in_progress", note: "Replacement lamp ordered. Temporary projector being installed.", changed_by: userIds.admin, created_at: days(0, -3) },
    { request_id: complaints[1].id, status: "submitted", note: "Complaint submitted by student.", changed_by: userIds.student, created_at: days(0, -4) },
    { request_id: complaints[2].id, status: "submitted", note: "Complaint submitted by student.", changed_by: userIds.priya, created_at: days(-1) },
    { request_id: complaints[2].id, status: "under_review", note: "Electrical team notified.", changed_by: userIds.admin, created_at: days(0, -6) },
    { request_id: complaints[3].id, status: "submitted", note: "Complaint submitted by student.", changed_by: userIds.kabir, created_at: days(-4) },
    { request_id: complaints[3].id, status: "assigned", note: "Assigned to Dr. Sanjay Kulkarni.", changed_by: userIds.admin, created_at: days(-1) },
  ]);

  await admin.from("maintenance_comments").insert([
    { request_id: complaints[0].id, author_id: userIds.admin, body: "Temporary projector will be available by tomorrow morning.", is_internal: false, created_at: days(0, -3) },
  ]);

  await admin.from("notifications").insert([
    { user_id: userIds.student, title: "Print job ready for collection", body: "Your resume print job is waiting at the PrintPulse desk.", link: "/printpulse", type: "print", created_at: days(0, -1, -30) },
    { user_id: userIds.student, title: "New message in DBMS Doubt Clearing", body: "Ananya Rao shared notes from today's class.", link: "/mentorloop", type: "message", created_at: days(0, -2) },
    { user_id: userIds.student, title: "Mid-sem exam timetable published", body: "Check your examination dates in TimeGrid.", link: "/timegrid", type: "announcement", created_at: days(0, -3) },
    { user_id: userIds.meera, title: "New question in DBMS Doubt Clearing", body: "Aarav Sharma asked about BCNF vs 3NF.", link: "/mentorloop", type: "message", created_at: days(0, -1) },
    { user_id: userIds.meera, title: "Maintenance issue assigned to you", body: "FX projector complaint in C-102.", link: "/fixora", type: "maintenance", created_at: days(0, -3) },
    { user_id: userIds.admin, title: "Print requests waiting in queue", body: "PrintPulse has jobs awaiting processing.", link: "/printpulse", type: "print", created_at: days(0, -2) },
    { user_id: userIds.admin, title: "Urgent complaint: water leakage", body: "Main Block first floor.", link: "/fixora", type: "maintenance", created_at: days(0, -4) },
  ]);

  await admin.from("audit_logs").insert([
    { actor_id: userIds.admin, action: "maintenance.assigned", entity: "maintenance_requests", entity_id: complaints[0].id, details: { assigned_to: "Dr. Meera Iyer" }, created_at: days(-1, -2) },
    { actor_id: userIds.admin, action: "announcement.published", entity: "announcements", entity_id: null, details: { title: "Mid-semester examination timetable published" }, created_at: days(0, -3) },
  ]);

  console.log("\nUniSync demo data seeded.");
  console.log("Sign in with student@unisync.edu / faculty@unisync.edu / admin@unisync.edu");
  console.log(`Password for all demo accounts: ${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
