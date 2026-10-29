import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  GraduationCap,
  LockKeyhole,
  MessagesSquare,
  Printer,
  ShieldCheck,
  Trophy,
  UsersRound,
  Wrench,
  Zap,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import { APP_TAGLINE, MODULES } from "@/lib/constants";
import { Badge, ButtonLink } from "@/components/ui";

const ICONS = {
  Printer,
  CalendarDays: CalendarCheck2,
  MessagesSquare,
  Trophy,
  Wrench,
} as const;

const PROBLEMS = [
  {
    title: "Announcements get lost",
    body: "Notices scattered across WhatsApp groups, notice boards and email mean students miss what matters.",
    icon: BellRing,
  },
  {
    title: "Queues for everything",
    body: "Printing, approvals and complaints still depend on physically waiting in the right corridor.",
    icon: Zap,
  },
  {
    title: "No single source of truth",
    body: "Timetable changes, mentorship and deadlines live in different places with conflicting versions.",
    icon: CalendarCheck2,
  },
  {
    title: "No accountability",
    body: "Maintenance reports disappear into notebooks with no status, owner or resolution trail.",
    icon: ShieldCheck,
  },
];

const BENEFITS = {
  Students: [
    "One dashboard for classes, print jobs, deadlines and complaints",
    "Track a print queue position before leaving the hostel",
    "Ask mentors questions in authorized, focused groups",
    "Report a broken projector without walking to the office",
  ],
  Faculty: [
    "See today's classes and group activity at a glance",
    "Publish academic announcements to the right audience",
    "Respond to students in moderated mentor groups",
    "Share internships, hackathons and scholarships",
  ],
  Administrators: [
    "Live operational analytics for print and maintenance",
    "Manage timetables with automatic conflict prevention",
    "Assign complaints and enforce service timelines",
    "Audit role changes and privileged actions",
  ],
};

export default async function LandingPage() {
  const profile = await getCurrentProfile();
  const demo = isDemoMode();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-bold leading-tight text-navy-900">UniSync</span>
              <span className="block text-[9px] uppercase tracking-[0.16em] text-muted">Campus, connected</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-xs font-medium text-slate-600 md:flex">
            <a href="#problem" className="hover:text-ink">Problem</a>
            <a href="#modules" className="hover:text-ink">Modules</a>
            <a href="#benefits" className="hover:text-ink">Benefits</a>
            <a href="#security" className="hover:text-ink">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            {profile ? (
              <ButtonLink href="/dashboard" size="sm" variant="primary">
                Open dashboard <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" size="sm" variant="ghost" className="hidden sm:inline-flex">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/register" size="sm" variant="accent">
                  Get started
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="border-b border-navy-800 bg-navy-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Campus operations platform
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Manage print jobs, schedules, mentoring, opportunities, and maintenance in one place.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              UniSync gives students, faculty, and administrators one role-aware workspace for the
              services they use across campus.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={profile ? "/dashboard" : "/register"} size="lg" variant="accent">
                {profile ? "Go to dashboard" : "Create a student account"}
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink
                href="/login"
                size="lg"
                variant="secondary"
                className="!border-white/20 !bg-white/5 !text-white hover:!bg-white/10"
              >
                {demo ? "Try demo accounts" : "Sign in to campus"}
              </ButtonLink>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-teal" /> Student, faculty, and administrator workflows
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-teal" /> Database-enforced access controls
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <div className="rounded-2xl bg-white p-5 text-ink sm:p-6">
                <h2 className="text-sm font-semibold text-ink">Campus services</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Each module supports a specific campus workflow.
                </p>
                <ul className="mt-5 divide-y divide-line">
                  {MODULES.map((module) => {
                    const Icon = ICONS[module.icon as keyof typeof ICONS];
                    return (
                      <li key={module.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="mt-0.5 rounded-lg bg-canvas p-2 text-brand-blue">
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="text-xs font-semibold">{module.name}</h3>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{module.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <Badge tone="orange">The campus problem</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Five essential services. Five disconnected systems.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Students lose time to queues and missed notices. Faculty duplicate updates across channels.
            Administrators lack visibility until a problem becomes a complaint.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((problem) => (
            <div key={problem.title} className="rounded-2xl border border-line bg-canvas p-5">
              <problem.icon className="h-5 w-5 text-brand-orange" />
              <h3 className="mt-3 text-sm font-semibold text-ink">{problem.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{problem.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modules" className="border-y border-line bg-canvas py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <Badge tone="blue">The solution</Badge>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Five modules. One shared design system and database.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Each module solves one campus workflow. Together they give every role a single, consistent
                view of the day.
              </p>
            </div>
            <ButtonLink href="/register" variant="secondary" size="sm">
              Explore the platform <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((module, index) => {
              const Icon = ICONS[module.icon as keyof typeof ICONS];
              const ACCENTS = [
                "bg-orange-50 text-brand-orange",
                "bg-blue-50 text-brand-blue",
                "bg-teal-50 text-brand-teal",
                "bg-amber-50 text-amber-600",
                "bg-emerald-50 text-emerald-600",
              ];
              return (
                <div
                  key={module.key}
                  className={`group rounded-2xl border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-lift ${
                    index === 4 ? "sm:col-span-2 lg:col-span-1" : ""
                  }`}
                >
                  <div className={`inline-flex rounded-xl p-2.5 ${ACCENTS[index]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{module.name}</h3>
                    <span className="text-[10px] font-medium text-muted">{module.tagline}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{module.description}</p>
                  <Link
                    href="/login"
                    className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue"
                  >
                    Sign in to open <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
            <div className="flex flex-col justify-between rounded-2xl bg-navy-950 p-5 text-white">
              <div>
                <UsersRound className="h-5 w-5 text-brand-orange" />
                <h3 className="mt-3 text-sm font-semibold">Built for every role</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Students, faculty and administrators see different dashboards backed by one database and
                  row-level security.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {["Student", "Faculty", "Administrator"].map((role) => (
                  <span key={role} className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] text-slate-200">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="benefits" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <Badge tone="teal">Why it works</Badge>
          <h2 className="mx-auto mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Less running around. More time on campus.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {Object.entries(BENEFITS).map(([role, items], index) => (
            <div
              key={role}
              className={`rounded-2xl border p-6 ${
                index === 1 ? "border-navy-900 bg-navy-950 text-white" : "border-line bg-white"
              }`}
            >
              <h3 className={`text-sm font-semibold ${index === 1 ? "text-white" : "text-ink"}`}>{role}</h3>
              <ul className="mt-4 space-y-2.5">
                {items.map((item) => (
                  <li
                    key={item}
                    className={`flex items-start gap-2 text-xs leading-relaxed ${
                      index === 1 ? "text-slate-300" : "text-muted"
                    }`}
                  >
                    <CheckCircle2
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        index === 1 ? "text-brand-teal" : "text-emerald-500"
                      }`}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="security" className="border-y border-line bg-canvas py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge tone="navy">Security by design</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Authorization enforced in the database.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              UniSync doesn&apos;t hide buttons and call it security. Every table has Row Level Security,
              privileged actions validate roles server-side, and private documents use signed URLs in
              private storage buckets.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {[
                "Supabase Auth with secure, httpOnly session cookies",
                "PostgreSQL RLS on profiles, requests, groups and messages",
                "Students can only read their own print jobs and complaints",
                "Group messages readable by members only",
                "Roles can never be self-assigned; admin changes are audited",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
                  <span className="text-xs leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 font-mono text-[11px] leading-relaxed text-slate-600 shadow-card">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 text-[10px] text-slate-400">supabase/migrations/0002_rls.sql</span>
            </div>
            <pre className="whitespace-pre-wrap">
{`create policy "Students read own print requests"
on public.print_requests for select
using (
  student_id = auth.uid()
  or public.is_print_staff()
);

create policy "Group members read messages"
on public.group_messages for select
using (public.is_group_member(group_id));`}
            </pre>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-sans text-[10px] font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Policies tested for student, faculty and admin sessions
            </div>
          </div>
        </div>
      </section>

      <section className="bg-navy-950 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{APP_TAGLINE}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
            {demo
              ? "Open the demo accounts to browse all five modules as a student, faculty member or administrator."
              : "Sign in with your campus account to reach your timetable, print queue, groups and complaints."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/register" size="lg" variant="accent">
              Create an account <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink
              href="/login"
              size="lg"
              variant="secondary"
              className="!border-white/20 !bg-white/5 !text-white hover:!bg-white/10"
            >
              {demo ? "Open demo accounts" : "Sign in"}
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold text-ink">UniSync</span>
            <span className="text-[10px] text-muted">{APP_TAGLINE}</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-5 text-[11px] text-slate-600">
            <Link href="/privacy" className="hover:text-ink">
              Privacy policy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms and conditions
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </nav>
          <p className="text-[10px] text-muted">© {new Date().getFullYear()} UniSync</p>
        </div>
      </footer>
    </div>
  );
}
