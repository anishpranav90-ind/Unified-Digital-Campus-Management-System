// Temporary detail-route + permission smoke test. Usage: node scripts/smoke-details.mjs [origin]
const origin = process.argv[2] ?? "http://localhost:3210";
const users = {
  student: "11111111-1111-4111-8111-111111111101",
  faculty: "22222222-2222-4222-8222-222222222201",
  admin: "33333333-3333-4333-8333-333333333301",
};
const sections = ["printpulse", "fixora", "mentorloop", "opportune"];

async function text(path, uid) {
  const res = await fetch(origin + path, {
    headers: uid ? { cookie: `unisync_demo_uid=${uid}` } : {},
    redirect: "manual",
  });
  return { status: res.status, body: res.status === 200 ? await res.text() : "" };
}

let failures = 0;
for (const [role, uid] of Object.entries(users)) {
  for (const section of sections) {
    const list = await text(`/${section}`, uid);
    if (list.status !== 200) {
      failures++;
      console.log(`FAIL ${role} list /${section} -> ${list.status}`);
      continue;
    }
    const ids = [...new Set([...list.body.matchAll(new RegExp(`href="(/${section}/[0-9a-f-]{36})"`, "g"))].map((m) => m[1]))].slice(0, 2);
    if (!ids.length) {
      console.log(`note ${role} /${section}: no detail links rendered for this role`);
      continue;
    }
    for (const path of ids) {
      const detail = await text(path, uid);
      const bad = detail.status !== 200 || /Application error|Internal Server Error/i.test(detail.body);
      if (bad) failures++;
      console.log(`${bad ? "FAIL" : "ok  "} ${role.padEnd(8)} ${path} ${detail.status}`);
    }
  }
}

// student must not reach admin pages
for (const path of ["/admin", "/admin/users"]) {
  const res = await fetch(origin + path, {
    headers: { cookie: `unisync_demo_uid=${users.student}` },
    redirect: "manual",
  });
  const body = await res.text();
  // App Router streams a redirect as 200 + NEXT_REDIRECT when the guard runs late,
  // so require an actual redirect marker or a non-200 status.
  const redirected = res.status >= 300 && res.status < 400;
  const streamedRedirect = /NEXT_REDIRECT;[^"\\]*\/dashboard/.test(body);
  const leakedAdminData = /Total students|Audit trail|Users &amp; roles/.test(body);
  const blocked = (redirected || streamedRedirect) && !leakedAdminData;
  if (!blocked) failures++;
  console.log(`${blocked ? "ok  " : "FAIL"} student blocked from ${path} -> ${res.status} redirected=${redirected} streamed=${streamedRedirect} leak=${leakedAdminData}`);
}

// student must not edit a timetable (admin-only action surface)
const tg = await text("/timegrid", users.student);
const hasAdminEditor = /Add class|Save timetable entry/i.test(tg.body);
if (hasAdminEditor) failures++;
console.log(`${hasAdminEditor ? "FAIL" : "ok  "} student has no timetable editor`);

console.log(failures === 0 ? "\nDETAILS OK" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
