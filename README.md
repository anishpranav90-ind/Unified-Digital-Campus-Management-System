# UniSync

A unified campus operations platform for print jobs, timetables, mentor groups, opportunities, maintenance complaints and administrator oversight. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4 and Supabase (PostgreSQL, Auth, Storage, Realtime).

The six modules:

| Module | What it does |
|---|---|
| **PrintPulse** | PDF upload, DB-authoritative pricing, live queue position, estimated wait and staff-managed statuses |
| **TimeGrid** | Weekly timetable grid, exam schedule, correction requests and conflict-safe admin editing |
| **MentorLoop** | Mentor groups, membership controls, realtime group chat, read receipts and staff-imported verified activity profiles |
| **Opportune** | Interest-aware opportunity discovery, bookmarks, staff publishing and safe external apply links |
| **Fixora** | Maintenance reporting, status history, comments, priority and assignment workflow |
| **e-Cafe** | Payment-gated kitchen queue, daily tokens, express pickup lane and ready-only QR redemption |

Plus a unified dashboard for every role, notifications, global search, an administrator console with role management and an append-only audit trail, and public privacy and terms pages.

---

## MentorLoop verified activity imports

The group Activity Tracker accepts student proof submissions and staff-generated CSV exports; it does not connect directly to Google Forms, hackathon platforms, or publication databases. Students can create and edit only their own pending records. The assigned group mentor can verify/reject submissions and import source exports. The group roster is validated by student email, imports are attributed to the staff member, and duplicate source IDs for the same student are skipped. RLS limits activity reads to the assigned mentor/admin or the student concerned. Mentor review controls and inserts are guarded by RLS and database triggers. Activity inserts/updates are in the `supabase_realtime` publication and the mentor client subscribes to group-filtered Postgres changes; student rows remain protected by RLS.

Apply `20261105000100_mentorloop_verified_activity.sql` before using this feature. Download the CSV template from the group Activity Tracker. Headers, in order:

```csv
student_email,category,activity_type,title,source,source_record_id,occurred_at,proof_url
```

`category` must be `tech`, `research`, `culturals`, or `sports`. `activity_type` must be `google_form_submission`, `hackathon_registration`, `paper_publication`, or `other`. `occurred_at` should be an ISO-8601 timestamp; `proof_url` is optional and must use HTTPS. Imports are limited to 500 records and 1 MB per file.

Apply `20261105000200_mentorloop_live_proofs_rbac.sql` to enable student submissions, mentor verification, Realtime publication, and the database email-domain guard. Real Supabase sign-in and registration accept `college.edu.in` plus common providers (Gmail, Googlemail, Yahoo, Yahoo India, Ymail, Outlook, Hotmail, Live, iCloud, Rediffmail, Protonmail, Proton and Zoho) by default. Keep `INSTITUTIONAL_EMAIL_DOMAINS` in the server environment synchronized with `public.institutional_email_domains` if the allowlist changes. Demo-mode accounts are local-only and are not accepted by real Supabase authentication. Configure the Supabase Auth access-token/JWT expiry (recommended: 1 hour) in the Supabase project settings; the SSR auth cookie has an eight-hour sliding lifetime. The Supabase browser client must access its session cookie to authenticate Realtime WebSockets, so it is `Secure` in production and `SameSite=Lax`, but not `HttpOnly`.

---

## Quick start (demo, no setup)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. With no Supabase keys, the app runs a seeded in-memory backend. Data resets when the dev server restarts. Printer output is simulated and clearly labelled as such.

Demo accounts (password `unisync123`):

| Role | Email |
|---|---|
| Student | `student@unisync.edu` |
| Student | `priya@unisync.edu` |
| Faculty / mentor | `faculty@unisync.edu` |
| Administrator | `admin@unisync.edu` |

Use **Sign in with demo account** on the login screen to switch quickly. Production sign-up always creates a `student`; roles can only be changed by an administrator, enforced in the database.

---

## Production setup (Supabase)

### 1. Create the project

1. Create a project at [database.new](https://database.new).
2. In **Project Settings → API**, copy the project URL, the `anon` key and the `service_role` key.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Set `NEXT_PUBLIC_APP_URL` to your origin (for example `https://unisync.example.edu`).

### 2. Run the database migrations

Either connect the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --linked
```

First run `npx supabase login` and complete the browser/device authorization prompt. Then replace `YOUR_PROJECT_REF` with the project reference shown in Supabase **Project Settings → General**. Do not include angle brackets. The `--linked` option explicitly targets the linked remote project. For example:

```powershell
npx supabase link --project-ref cnkivbbycozmacebgecd
```

or apply the migrations with the bundled script, which records each file in `supabase_migrations.schema_migrations` (the same table the CLI uses) and applies `supabase/seed.sql`:

```bash
# SUPABASE_DB_URL = Project Settings → Database → session pooler connection string
npm run db:apply          # apply pending migrations + reference seed
npm run db:apply -- --status   # show applied/pending files
```

or paste the migrations into the SQL editor **in filename order**:

1. `supabase/migrations/20261023000100_schema.sql` — tables, enums, constraints, indexes
2. `supabase/migrations/20261023000200_functions_triggers.sql` — role helpers, integrity triggers, pricing and notifications
3. `supabase/migrations/20261023000300_rls.sql` — Row Level Security policies
4. `supabase/migrations/20261023000400_storage_realtime.sql` — private storage buckets, storage policies, realtime publication
5. `supabase/migrations/20261024000100_profile_guard_session_user.sql` — fixes the role guard so a `SECURITY DEFINER` trigger cannot be bypassed
6. `supabase/migrations/20261024000200_print_settings_singleton.sql` — collapses duplicate print settings and enforces a single row

The payment workflow adds:

7. `supabase/migrations/20261104000400_guarded_payments_ecafe.sql` — guarded PrintPulse/e-Cafe payment records and queue state
8. `supabase/migrations/20261104000500_razorpay_webhook_idempotency.sql` — Razorpay payment attempts, event idempotency, and atomic settlement
9. `supabase/migrations/20261105000100_mentorloop_verified_activity.sql` — MentorLoop verified activity records and staff imports
10. `supabase/migrations/20261105000200_mentorloop_live_proofs_rbac.sql` — student submissions, mentor verification, email-domain guard, and Realtime publication
11. `supabase/migrations/20261105000300_allow_consumer_email_domains.sql` — adds Gmail, Yahoo and other common providers to the sign-in allowlist
12. `supabase/migrations/20261105000400_ecafe_priority_queue.sql` — assigns daily tokens after verified payment, enables express/FIFO kitchen lanes, pickup QR redemption, and the Realtime token board
13. `supabase/migrations/20261105000500_transaction_history.sql` — adds the owner-scoped, paginated PrintPulse/e-Cafe transaction history query

Then apply the reference data (already included in `npm run db:apply`):

```bash
# SQL editor
supabase/seed.sql
```

The reference seed inserts departments and default print pricing. It is safe to run more than once.

### e-Cafe priority queue

Apply `20261105000400_ecafe_priority_queue.sql` after the guarded payments migrations. Cash orders stay in `PAYMENT_PENDING` and are excluded from the kitchen until a staff member verifies the cashier QR. A verified payment receives the next daily token atomically; Razorpay enters the queue only after the server-side settlement flow verifies the payment. Direct UPI intent is not a payment webhook and still requires counter verification against the bank reference.

Cafe staff use `/cashier` to scan a pending cash QR, review its item breakdown and exact amount, and confirm cash receipt. Confirmation reuses the guarded settlement flow and sends the order to `QUEUED`; unpaid orders remain hidden from the kitchen. Staff use `/ecafe/counter` to verify direct UPI receipts and move paid orders through `QUEUED → PREPARING → READY`; the pickup QR is available only in `READY`. Counter redemption changes a ready order to `COMPLETED`, while early scans return the order's position in its FIFO lane. `/ecafe/board` displays the live queue with separate express and standard lanes. The board contains only token numbers and statuses; its table has read-only authenticated access and is published through Supabase Realtime. Student order pages and the kitchen board receive the corresponding Realtime updates. Demo mode simulates updates with polling.

Users can open **Transaction History** from the profile dropdown at `/profile/transactions`. The page combines the signed-in user's PrintPulse jobs and e-Cafe orders, with category, search, date-range, and paginated filters. Its `/api/profile/transactions` endpoint uses the `list_my_transaction_history` database function, which is restricted to the caller's own records.

### 3. Seed the full demo dataset (optional)

```bash
npm run seed:demo
```

This creates eight confirmed demo users and representative data (timetable, print queue, groups, opportunities, complaints, notifications) from a single dataset in `scripts/demo-dataset.mjs`. It runs **locally only** and never inside the app. It uses the service-role key when `SUPABASE_SERVICE_ROLE_KEY` is set, or a direct `SUPABASE_DB_URL` connection otherwise; either way it bypasses RLS only for the seed transaction. If you previously seeded, the script reuses users and resets the domain tables.

### 4. Auth configuration

In **Authentication → URL Configuration**:

- **Site URL**: your `NEXT_PUBLIC_APP_URL`
- **Redirect URLs**: `<NEXT_PUBLIC_APP_URL>/auth/callback`

The callback route (`src/app/auth/callback/route.ts`) exchanges the Supabase code for a session. Email confirmation can stay enabled for production; for a quick private trial you may disable it in the Supabase dashboard. Never disable it on a public deployment.

### 5. Storage

The migration creates four **private** buckets with size and MIME limits:

- `print-documents` (PDF, 5 MB)
- `maintenance-photos` (PNG/JPEG/WebP, 5 MB)
- `message-attachments` (documents, images, text, ZIP, 5 MB)
- `announcement-attachments` (PDF/PNG/JPEG, 5 MB)

Object keys are namespaced by user ID and protected by storage policies. Files are served through authenticated routes or signed URLs, never public links.

### 6. Realtime

The final migration adds the app tables to the `supabase_realtime` publication. MentorLoop chat and queue/notification badges subscribe with the browser client and fall back to periodic refresh if realtime is unavailable. If you create a fresh Supabase project and modify the publication manually, confirm these tables are included.

### 7. Run

```bash
npm run dev
```

Demo mode turns off automatically once both Supabase keys are present. Set `NEXT_PUBLIC_DEMO_MODE=false` to fail closed rather than silently using the demo backend.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Public anon key (RLS still applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks/seeder | Server-side Razorpay settlement and local seeding; never expose to the client |
| `SUPABASE_DB_URL` | Scripts only | Direct Postgres URL for `db:apply` and the database transport of `seed:demo` |
| `NEXT_PUBLIC_APP_URL` | Production | Origin used for auth redirects |
| `RAZORPAY_KEY_ID` | Razorpay Checkout | Server-side API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay Checkout | Server-side API secret; never expose to the client |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhooks | Secret configured for the Razorpay webhook endpoint; server-side only |
| `NEXT_PUBLIC_DEMO_MODE` | No | `true` forces demo, `false` requires Supabase, blank auto-detects |
| `INSTITUTIONAL_EMAIL_DOMAINS` | Supabase Auth | Comma-separated exact domains allowed for login and registration. Defaults to the campus domain plus Gmail, Yahoo, Outlook, Hotmail, iCloud, Live, Rediffmail, Proton and Zoho; keep synchronized with the database allowlist |
| `DEMO_PASSWORD` | No | Demo account password (default `unisync123`) |
| `CUPS_SJIT_GIRLS_XEROX_1_URI` | CUPS only | Server-side IPP/IPPS URI for SJIT Girls Xerox-1 |
| `CUPS_SJIT_BOYS_XEROX_1_URI` | CUPS only | Server-side IPP/IPPS URI for SJIT-Boys Xerox-1 |
| `CUPS_SJCE_BOYS_XEROX_1_URI` | CUPS only | Server-side IPP/IPPS URI for SJCE Boys Xerox-1 |
| `CUPS_SJCE_GIRLS_XEROX_1_URI` | CUPS only | Server-side IPP/IPPS URI for SJCE Girls Xerox-1 |
| `CUPS_SJIT_PERIWINKLE_XEROX_URI` | CUPS only | Server-side IPP/IPPS URI for SJIT-Periwinkle Xerox |
| `CUPS_USERNAME`, `CUPS_PASSWORD` | CUPS only | Optional Basic Auth pair; only accepted with IPPS |
| `CUPS_REQUESTING_USER` | No | IPP job owner label (default `unisync`) |

Never prefix a secret with `NEXT_PUBLIC_`. `.env*` is gitignored; only `.env.example` is tracked.

### Razorpay webhook deployment

- Configure the Razorpay Dashboard webhook URL as `https://YOUR_PRODUCTION_DOMAIN/api/webhooks/razorpay`.
- Subscribe to `payment.authorized`, `payment.captured`, `payment.failed`, and `order.paid`.
- In Vercel, add `RAZORPAY_WEBHOOK_SECRET` with the exact secret configured for that webhook. Also configure `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` as server-only variables for the corresponding deployment environments. Do not use a `NEXT_PUBLIC_` prefix.
- Apply pending database migrations before enabling webhook delivery. Redeploy the Vercel project after changing environment variables so the new deployment receives them.
- Run `npm run test:razorpay-webhook` for request validation and handler tests. A Razorpay test-mode payment and a connected Supabase project are still required to verify end-to-end event settlement.

---

## Roles and permissions

| Capability | Student | Faculty | Admin |
|---|:--:|:--:|:--:|
| View own print jobs, complaints, notifications | ✓ | ✓ | ✓ |
| Create print jobs / maintenance reports | ✓ | — | — |
| Manage print queue and pricing | — | queue | queue + pricing |
| Edit timetable / exam schedule | — | request correction | ✓ |
| Publish announcements and opportunities | — | ✓ | ✓ |
| Create mentor groups, manage own group members | — | ✓ | ✓ |
| Assign complaints, change status and priority | — | ✓ | ✓ |
| Manage users, roles, audit log | — | — | ✓ |

Server actions re-check the session and role. The database enforces the same rules independently.

### RLS model

- Every app table has RLS enabled.
- Students read only their own print requests, maintenance requests, bookmarks and notifications; print staff and admins see the queue.
- Maintenance history and comments are restricted through `can_access_maintenance()`.
- Group content is readable only by group members (mentors can read their group before joining); non-members cannot enumerate it.
- Announcements are filtered by audience (`all`, `students`, `faculty`, `admins`).
- Opportunity bookmarks are unique per user and cannot be written for another user.
- Only administrators can update roles. A trigger blocks self-promotion even through direct REST calls.
- Audit logs are admin-readable and written by privileged server actions.
- Anonymous users get no access to app data; departments alone are publicly readable for the registration form.
- Print pricing is computed or validated in the database, not trusted from the browser.

Verify the policies against a seeded project:

```bash
npm run test:rls
```

The script signs in as four accounts and checks cross-user print jobs, complaints, group messages, role escalation, audit access, duplicate bookmarks and anonymous reads. It creates and removes a temporary group. A live Supabase project is required; it cannot run in demo mode. This suite has been run against a live project with all five migrations applied and the demo dataset seeded: **17 passed, 0 failed**.

---

## Testing checklist

Manual flows used during development:

1. **Student** — log in, view dashboard, upload `demo-document.pdf` in PrintPulse, see cost/queue; save an opportunity; create a maintenance ticket; send a group message; request a timetable correction.
2. **Faculty** — view today's classes; publish an announcement; create a mentor group; change a print job to processing; update a complaint assigned to them.
3. **Admin** — see campus stats; edit print pricing; add a timetable slot and confirm a classroom conflict is rejected; publish an opportunity; assign/resolve a complaint; change a user role; inspect audit entries.
4. **Security** — sign out and hit `/dashboard`, `/admin`, `/fixora` directly; confirm redirects. Run `npm run test:rls`.
5. **Responsive** — check the mobile navigation drawer and cards at 375 px and desktop at 1280 px.

Automated checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Against a running **demo-mode** server (blank Supabase keys), two smoke scripts check every page and detail route for all three roles, confirm anonymous redirects and role guards, and fail on any 500 or Next.js error page:

```bash
npm run test:routes
npm run test:details
```

Both accept an origin argument, for example `npm run test:routes -- http://localhost:3210`, or the `SMOKE_ORIGIN` environment variable. They sign in through the demo account buttons, so against a Supabase-backed server every signed-in route reports `307 /login` and the run fails. Use the manual checklist or `npm run test:rls` in that case.

---

## Deployment (Vercel + Supabase)

1. Push the repository to GitHub.
2. Import the project in Vercel. Framework preset: Next.js. Build command `npm run build`.
3. Add the production environment variables from the table above. Add `SUPABASE_SERVICE_ROLE_KEY` only as a server-side Vercel environment variable; never expose it with a `NEXT_PUBLIC_` prefix.
4. Add and verify the chosen custom domain in Vercel, configure its DNS records, and confirm HTTPS is active.
5. Set `NEXT_PUBLIC_APP_URL`, the Supabase Site URL and redirect allow-list to the verified custom domain.
6. Complete every item in the launch gate below before deploying publicly.
7. Deploy, then sign in and smoke-test all three roles.
8. Optionally schedule deadline reminders:

```bash
npm run reminders
```

Run it daily with a GitHub Action, cron host or a scheduled Supabase Edge Function. It creates in-app notifications for opportunities closing within three days. It does not send email or push.

### Connecting the custom domain

No domain has been chosen for this project, so this step is still open. When you have one:

1. Add the exact hostname in Vercel under **Project → Settings → Domains**.
2. Create the DNS record Vercel shows for that hostname at your DNS provider. Copy the record from the panel instead of guessing: a subdomain normally needs a `CNAME`, an apex domain an `A` record.
3. Wait until Vercel reports the domain as valid and HTTPS as active. Do not announce the site before this passes.
4. Set `NEXT_PUBLIC_APP_URL` to `https://<domain>` in Vercel and redeploy, so canonical URLs, Open Graph tags and auth redirects use the real origin.
5. In Supabase, open **Authentication → URL Configuration** and set **Site URL** to `https://<domain>`, then add `https://<domain>/auth/callback` to **Redirect URLs**.
6. Repeat the role flows and `npm run test:rls`, and check `/privacy` and `/terms` on the new origin.

### Free-plan caveat

Supabase free-tier projects are resource-constrained and can be paused after inactivity. Check current quotas before relying on them for a live campus; upgrade the project for production traffic. Avoid storing large files in the database — the app uses private Storage buckets instead.

---

## Integrations and honest limitations

- **Printing is simulated by default.** Each new request selects one of five Xerox locations. To enable CUPS, configure the five server-only location-specific URIs (`ipp://` or preferably `ipps://`), plus `CUPS_USERNAME` and `CUPS_PASSWORD` when the server requires Basic Auth. Credentials are only accepted with IPPS. Then select **CUPS / IPP** in the PrintPulse admin settings. UniSync routes each PDF and its print options to the selected location when staff move it to *processing*, then stores the CUPS job ID to prevent accidental resubmission. CUPS acceptance is not proof that paper finished printing; staff must verify the queue/output before marking a job *ready*. Run migrations `20261104000100_add_cups_job_id.sql`, `20261104000200_add_print_location.sql`, and `20261104000300_update_print_locations.sql` before enabling CUPS. The application host must have network access to all configured CUPS queues; configure and test against the actual printers before production use.
- **PDF handling is metadata-only.** The upload form validates MIME type and size; the app does not render or parse PDF contents, so page count is entered by the student and capped by settings. Before charging real money, add server-side PDF parsing and verify the page count.
- **Push notifications and fee payments are not built.** FCM and Razorpay were listed as optional in the brief and are intentionally omitted rather than half-wired. In-app notifications are fully implemented. A payment provider would need order creation, signature verification and reconciliation before any fee feature ships.
- **Demo mode is in-memory.** It exists for evaluation and preview deployments; do not treat it as persistent storage.
- **The SQL migrations were applied and the RLS suite passes against a live project.** `npm run test:rls` reports 17/17 after `npm run db:apply` and `npm run seed:demo`. Re-run it against your own project before launch; the suite depends on the demo users existing.

---

## Project structure

```
src/
  app/
    (auth)/            login, register
    (legal)/           privacy policy and terms and conditions
    (app)/             authenticated shell: dashboard, modules, admin, profile
    api/search         permission-aware global search
    api/printpulse     authenticated PDF download
    auth/callback      Supabase code exchange
  components/
    layout/            sidebar, topbar, search, notifications, profile menu
    dashboard/         module grid, schedules, charts
    ui/                design system
    modules/           shared module badges
  lib/
    actions/           server actions with validation + role checks
    data/              demo/Supabase data access, one file per module
    demo/              in-memory seeded backend
    supabase/          browser, server and admin clients
    printer/           printer adapter boundary
    env.ts             demo-mode detection
    session.ts         current profile and role guards
supabase/
  migrations/          schema, functions, RLS, storage + realtime, guard fix
  seed.sql             departments and default pricing
scripts/
  db-apply.mjs         apply migrations + reference seed over SUPABASE_DB_URL
  demo-dataset.mjs     the demo dataset, transport-agnostic
  seed-demo.mjs        full demo dataset (service key or database URL)
  generate-icons.mjs   favicon, SVG icon and Apple touch icon
  test-rls.mjs         policy verification
  smoke-routes.mjs     every page, all three roles (demo)
  smoke-details.mjs    detail pages and role guards (demo)
  deadline-reminders.mjs
```

---

## Design

A calm campus-operations palette: deep navy (`#0b1f3a`), soft canvas (`#f6f8fb`), and orange, blue, teal, amber and green accents. There is no purple in the palette and no gradient anywhere in the interface, including the authentication panel. Cards use 14 to 18 px radii, buttons and inputs 12 px, and filter chips 6 to 8 px, so no control is pill-shaped. Shadows are restrained, tables dense but readable, and badges share one status language. Typography is Geist via `next/font`. All screens are responsive, keyboard-focusable and use semantic landmarks.

Keep the interface specific and factual: no purple gradients, pill-shaped buttons, vague hero copy, emoji icons, fake reviews, fabricated metrics or customer counters, AI-generated photos or copy, cursor animations, or excessive scroll effects. Do not add a third-party “Made with AI” attribution. Use no motion for marketing effect; ordinary functional state feedback is fine. Empty values read "Not set" rather than a dash, and prose uses no em dashes.

Icons are generated, not hand-drawn: `scripts/generate-icons.mjs` writes `src/app/icon.svg`, `src/app/favicon.ico` (16, 32 and 48 px) and `src/app/apple-icon.png` from one vector description. Run `node scripts/generate-icons.mjs` after changing the mark.

## Launch gate

Do not launch publicly until all items are complete and verified:

- [x] **Favicon.** `src/app/favicon.ico`, `src/app/icon.svg` and `src/app/apple-icon.png` are served from the app directory. Verified against a running server: `/favicon.ico` returns `image/x-icon` with three embedded sizes, `/icon.svg` returns `image/svg+xml`, `/apple-icon.png` returns a 180 px PNG, and the document head links all three.
- [x] **Privacy policy and terms.** Published at `/privacy` and `/terms`, linked from the site footer and from the sign-up form. The copy is written against the data flows of this repository, not boilerplate. It still needs sign-off from the institution's legal or compliance office, and the contact section names the campus IT service desk rather than an individual officer.
- [x] **Attribution.** There is no “Made with” label in the application, and none is generated at build time. The served HTML of `/`, `/privacy`, `/terms`, `/login` and `/register`, plus the production build output, were checked for `made with`, `built with`, `powered by` and `freebuff`. The only `codeBuff` substring in the build is inside the minified identifier `decodeBufferedStage`. While previewing locally a small purple “Freebuff” chip appears in the top-left corner: that is injected by the Freebuff preview browser into every page it opens, including example.com, and it never reaches a deployed build.
- [ ] **Custom domain.** Hosting decision: Vercel. No domain exists yet, so nothing can be pointed at the deployment. **Blocked: a domain has to be registered or allocated by the institution.** Follow "Connecting the custom domain" in the deployment section once you have the exact hostname; the same hostname must be added to the Supabase Site URL and redirect allow-list.
- [ ] **Launch verification.** Re-run the role flows and `npm run test:rls` on the custom domain, with the browser console open, before announcing availability.

## Troubleshooting

| Symptom | Fix |
|---|---|
| App keeps using demo data | Both Supabase keys must be non-empty, or set `NEXT_PUBLIC_DEMO_MODE=false` and restart |
| Login redirects to the wrong host | Set `NEXT_PUBLIC_APP_URL` and the Supabase Site URL/redirect allow-list |
| "new row violates row-level security policy" | Check the signed-in role and the relevant policy in `20261023000300_rls.sql`; admins cannot be created through the registration form |
| Realtime does not update | Confirm the tables are in the `supabase_realtime` publication and the browser key is the anon key |
| CUPS job not submitted | Apply both print migrations, configure the selected location's CUPS URI, and select CUPS / IPP in PrintPulse admin settings; check the CUPS queue before retrying an ambiguous submission |
