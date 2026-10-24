// Temporary route smoke test for demo mode. Usage: node scripts/smoke-routes.mjs [origin]
const origin = process.argv[2] ?? "http://localhost:3210";

const users = {
  student: "11111111-1111-4111-8111-111111111101",
  faculty: "22222222-2222-4222-8222-222222222201",
  admin: "33333333-3333-4333-8333-333333333301",
};

const routes = [
  "/dashboard",
  "/printpulse",
  "/printpulse/new",
  "/timegrid",
  "/mentorloop",
  "/opportune",
  "/fixora",
  "/fixora/new",
  "/announcements",
  "/notifications",
  "/profile",
];

const adminRoutes = ["/admin", "/admin/users"];

async function get(path, uid, redirect = "manual") {
  const res = await fetch(origin + path, {
    headers: uid ? { cookie: `unisync_demo_uid=${uid}` } : {},
    redirect,
  });
  const text = res.status === 200 ? await res.text() : "";
  const errors = [];
  if (/Application error|Internal Server Error|Unhandled Runtime Error/i.test(text)) errors.push("error page");
  const nextErr = text.match(/__NEXT_ERROR_CODE|digest&quot;/);
  if (nextErr) errors.push("next error digest");
  return { status: res.status, location: res.headers.get("location"), errors };
}

let failures = 0;
for (const [role, uid] of Object.entries(users)) {
  const list = role === "admin" ? [...routes, ...adminRoutes] : routes;
  for (const path of list) {
    const r = await get(path, uid);
    const bad = r.status !== 200 || r.errors.length;
    if (bad) failures++;
    console.log(`${bad ? "FAIL" : "ok  "} ${role.padEnd(8)} ${path.padEnd(20)} ${r.status} ${r.location ?? ""} ${r.errors.join(",")}`);
  }
}

// anonymous access must redirect to login
for (const path of ["/dashboard", "/admin", "/fixora", "/mentorloop", "/opportune"]) {
  const res = await fetch(origin + path, { redirect: "manual" });
  const okRedirect = res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").includes("login");
  if (!okRedirect) failures++;
  console.log(`${okRedirect ? "ok  " : "FAIL"} anon     ${path.padEnd(20)} ${res.status} ${res.headers.get("location") ?? ""}`);
}

console.log(failures === 0 ? "\nALL ROUTES OK" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
