import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Megaphone,
  MessagesSquare,
  Plus,
  Printer,
  ShieldCheck,
  Timer,
  Trophy,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import type { AppNotification, Profile } from "@/types";
import { requireProfile } from "@/lib/session";
import { PRINT_STATUS_META } from "@/lib/constants";
import { dayName, daysUntil, firstName, formatCurrency, formatDate, formatTime, timeAgo, todayDayNumber } from "@/lib/utils";
import { listAnnouncements } from "@/lib/data/announcements";
import { listNotifications } from "@/lib/data/notifications";
import { listPrintRequests, getPrintQueueInfo } from "@/lib/data/printpulse";
import { getExamSchedule, getTimetable } from "@/lib/data/timegrid";
import { getUnreadMessageTotal, listMentorGroups } from "@/lib/data/mentorloop";
import { getUpcomingDeadlines } from "@/lib/data/opportune";
import { listMaintenanceRequests } from "@/lib/data/fixora";
import { getAdminStats } from "@/lib/data/admin";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, StatCard } from "@/components/ui";
import { ModuleGrid } from "@/components/dashboard/module-grid";
import { AnnouncementsList } from "@/components/dashboard/announcements-list";
import { ScheduleList } from "@/components/dashboard/schedule-list";
import { ColumnChart, DonutChart, Legend } from "@/components/dashboard/charts";

export const metadata = { title: "Dashboard" };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function NotificationMini({ notifications }: { notifications: AppNotification[] }) {
  if (!notifications.length) {
    return <EmptyState icon={<Clock className="h-5 w-5" />} title="Nothing new right now" />;
  }
  return (
    <ul className="divide-y divide-line">
      {notifications.slice(0, 5).map((notification) => (
        <li key={notification.id}>
          <Link
            href={notification.link ?? "/notifications"}
            className="flex gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                notification.is_read ? "bg-slate-200" : "bg-brand-orange"
              }`}
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ink">{notification.title}</span>
              <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted">{notification.body}</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">{timeAgo(notification.created_at)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PageIntro({ profile }: { profile: Profile }) {
  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">{dateLabel}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {greeting()}, {firstName(profile.full_name)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {profile.role === "student"
            ? "Here is everything happening on campus today."
            : profile.role === "faculty"
              ? "Your classes, mentorships and campus updates in one place."
              : "Live campus operations and service health."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {profile.role === "student" ? (
          <>
            <ButtonLink href="/printpulse/new" size="sm" variant="accent">
              <Plus className="h-3.5 w-3.5" /> New print job
            </ButtonLink>
            <ButtonLink href="/fixora/new" size="sm" variant="secondary">
              <Wrench className="h-3.5 w-3.5" /> Report issue
            </ButtonLink>
          </>
        ) : profile.role === "faculty" ? (
          <>
            <ButtonLink href="/announcements" size="sm" variant="accent">
              <Megaphone className="h-3.5 w-3.5" /> Announce
            </ButtonLink>
            <ButtonLink href="/opportune" size="sm" variant="secondary">
              <Trophy className="h-3.5 w-3.5" /> Share opportunity
            </ButtonLink>
          </>
        ) : (
          <>
            <ButtonLink href="/admin" size="sm" variant="accent">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin console
            </ButtonLink>
            <ButtonLink href="/admin/users" size="sm" variant="secondary">
              <Users className="h-3.5 w-3.5" /> Manage users
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();

  if (profile.role === "admin") return <AdminDashboard profile={profile} />;
  if (profile.role === "faculty") return <FacultyDashboard profile={profile} />;
  return <StudentDashboard profile={profile} />;
}

async function StudentDashboard({ profile }: { profile: Profile }) {
  const [announcements, notifications, timetable, prints, queue, complaints, deadlines, exams] =
    await Promise.all([
      listAnnouncements(profile, 3),
      listNotifications(profile, 5),
      getTimetable(profile),
      listPrintRequests(profile, { limit: 6 }),
      getPrintQueueInfo(profile),
      listMaintenanceRequests(profile),
      getUpcomingDeadlines(profile, 3),
      getExamSchedule(profile),
    ]);

  const today = todayDayNumber();
  const todayClasses = timetable
    .filter((entry) => entry.day_of_week === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const activePrints = prints.filter((request) =>
    ["submitted", "queued", "processing", "ready"].includes(request.status),
  );
  const openComplaints = complaints.filter((request) => !["resolved", "rejected"].includes(request.status));
  const nextExam = exams[0];
  const unread = notifications.filter((notification) => !notification.is_read).length;
  const activePrint = activePrints[0];

  return (
    <div>
      <PageIntro profile={profile} />

      <ModuleGrid
        counts={{
          printpulse: `${activePrints.length} active`,
          timegrid: `${todayClasses.length} classes today`,
          mentorloop: "Groups & messages",
          opportune: `${deadlines.length} closing soon`,
          fixora: `${openComplaints.length} open`,
        }}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending print jobs"
          value={activePrints.length}
          hint={queue.position ? `Your queue position: #${queue.position}` : "No active job in queue"}
          icon={<Printer className="h-5 w-5" />}
          tone="orange"
          href="/printpulse"
        />
        <StatCard
          label="Estimated print wait"
          value={queue.estimated_wait_minutes ? `${queue.estimated_wait_minutes} min` : "Not set"}
          hint={`${queue.pending} waiting · ${queue.processing} printing`}
          icon={<Timer className="h-5 w-5" />}
          tone="blue"
          href="/printpulse"
        />
        <StatCard
          label="Open maintenance"
          value={openComplaints.length}
          hint={openComplaints[0] ? openComplaints[0].ticket_number : "Nothing pending"}
          icon={<Wrench className="h-5 w-5" />}
          tone="green"
          href="/fixora"
        />
        <StatCard
          label="Unread notifications"
          value={unread}
          hint="Announcements, jobs and replies"
          icon={<Megaphone className="h-5 w-5" />}
          tone="amber"
          href="/notifications"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Today's timetable"
              description={`${dayName(today)} · ${todayClasses.length} classes`}
              icon={<CalendarDays className="h-4 w-4" />}
              action={
                <Link href="/timegrid" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  Full week
                </Link>
              }
            />
            <ScheduleList entries={todayClasses} />
          </Card>

          <Card>
            <CardHeader
              title="Print activity"
              description="Live queue position for your active job"
              icon={<Printer className="h-4 w-4" />}
              action={
                <Link href="/printpulse" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  Open PrintPulse
                </Link>
              }
            />
            {activePrint ? (
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{activePrint.document_name}</p>
                      <Badge tone={PRINT_STATUS_META[activePrint.status]?.tone as "blue"}>
                        {PRINT_STATUS_META[activePrint.status]?.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {activePrint.request_number} · {activePrint.pages} pages · {activePrint.copies} copy
                      {activePrint.copies > 1 ? "ies" : ""} · {formatCurrency(activePrint.estimated_cost)}
                    </p>
                  </div>
                  <Link
                    href={`/printpulse/${activePrint.id}`}
                    className="text-[11px] font-semibold text-brand-blue hover:underline"
                  >
                    View job
                  </Link>
                </div>

                <div className="mt-4 rounded-xl bg-canvas p-4">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted">
                    <span>Queue position</span>
                    <span>{queue.position ? `#${queue.position} of ${queue.pending + queue.processing}` : "Ready for collection"}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-brand-orange"
                      style={{
                        width: `${Math.max(
                          8,
                          queue.position
                            ? 100 - ((queue.position - 1) / Math.max(1, queue.pending + queue.processing)) * 100
                            : 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
                    <span>{queue.processing} processing</span>
                    <span>~{queue.estimated_wait_minutes} min estimated</span>
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-amber-700">
                  Simulated printing. No physical printer is connected in this environment.
                </p>
              </div>
            ) : (
              <EmptyState
                icon={<Printer className="h-5 w-5" />}
                title="No active print jobs"
                description="Upload a PDF to join the print queue."
                action={
                  <ButtonLink href="/printpulse/new" size="sm" variant="accent">
                    <Plus className="h-3.5 w-3.5" /> New print job
                  </ButtonLink>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Deadlines & opportunities"
              description="Based on your interests"
              icon={<Trophy className="h-4 w-4" />}
              action={
                <Link href="/opportune" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  Explore
                </Link>
              }
            />
            {deadlines.length ? (
              <ul className="divide-y divide-line">
                {deadlines.map((opportunity) => (
                  <li key={opportunity.id}>
                    <Link
                      href={`/opportune/${opportunity.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-[9px] font-bold uppercase text-slate-500">
                        <span className="text-sm leading-none text-ink">
                          {new Date(opportunity.deadline).getDate()}
                        </span>
                        {new Date(opportunity.deadline).toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{opportunity.title}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {opportunity.organization} · {opportunity.category.replace("_", " ")}
                        </span>
                      </span>
                      <Badge tone="amber">{daysUntil(opportunity.deadline)} days</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Trophy className="h-5 w-5" />} title="No upcoming deadlines" />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Announcements"
              icon={<Megaphone className="h-4 w-4" />}
              action={
                <Link href="/announcements" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  All
                </Link>
              }
            />
            <AnnouncementsList announcements={announcements} />
          </Card>

          {nextExam ? (
            <Card className="overflow-hidden">
              <div className="bg-navy-950 p-5 text-white">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <CalendarClock className="h-3.5 w-3.5 text-brand-orange" /> Next examination
                </p>
                <p className="mt-2 text-sm font-semibold">{nextExam.subject?.name}</p>
                <p className="mt-0.5 text-xs text-slate-300">
                  {formatDate(nextExam.exam_date)} · {formatTime(nextExam.start_time)} · {nextExam.room}
                </p>
                <Link href="/timegrid#exams" className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-orange">
                  Exam schedule <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Recent notifications"
              icon={<Clock className="h-4 w-4" />}
              action={
                <Link href="/notifications" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  All
                </Link>
              }
            />
            <NotificationMini notifications={notifications} />
          </Card>

          <Card>
            <CardHeader
              title="My maintenance reports"
              icon={<Wrench className="h-4 w-4" />}
              action={
                <Link href="/fixora" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  Open Fixora
                </Link>
              }
            />
            {complaints.length ? (
              <ul className="divide-y divide-line">
                {complaints.slice(0, 3).map((request) => (
                  <li key={request.id} className="px-5 py-3">
                    <Link href={`/fixora/${request.id}`} className="block">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-ink">{request.title}</p>
                        <span className="shrink-0 text-[10px] font-medium text-muted">
                          {request.ticket_number}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] capitalize text-muted">
                        {request.status.replace("_", " ")} · {request.building} {request.room}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No complaints filed" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

async function FacultyDashboard({ profile }: { profile: Profile }) {
  const [announcements, timetable, groups, maintenance, deadlines, unreadMessages] = await Promise.all([
    listAnnouncements(profile, 3),
    getTimetable(profile),
    listMentorGroups(profile),
    listMaintenanceRequests(profile),
    getUpcomingDeadlines(profile, 3),
    getUnreadMessageTotal(profile),
  ]);

  const today = todayDayNumber();
  const todayClasses = timetable
    .filter((entry) => entry.day_of_week === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const openIssues = maintenance.filter((request) => !["resolved", "rejected"].includes(request.status));

  return (
    <div>
      <PageIntro profile={profile} />

      <ModuleGrid
        counts={{
          printpulse: "Print desk queue",
          timegrid: `${todayClasses.length} classes today`,
          mentorloop: `${groups.length} groups`,
          opportune: `${deadlines.length} closing soon`,
          fixora: `${openIssues.length} assigned`,
        }}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Classes today"
          value={todayClasses.length}
          hint={todayClasses[0] ? `First at ${formatTime(todayClasses[0].start_time)}` : "No classes today"}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="blue"
          href="/timegrid"
        />
        <StatCard
          label="Mentor groups"
          value={groups.length}
          hint={`${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`}
          icon={<MessagesSquare className="h-5 w-5" />}
          tone="teal"
          href="/mentorloop"
        />
        <StatCard
          label="Assigned maintenance"
          value={openIssues.length}
          hint="Complaints needing attention"
          icon={<Wrench className="h-5 w-5" />}
          tone="green"
          href="/fixora"
        />
        <StatCard
          label="Live opportunities"
          value={deadlines.length}
          hint="Deadlines in the next 30 days"
          icon={<Trophy className="h-5 w-5" />}
          tone="orange"
          href="/opportune"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Today's teaching schedule"
              description={`${dayName(today)} · ${todayClasses.length} classes`}
              icon={<CalendarDays className="h-4 w-4" />}
              action={
                <Link href="/timegrid" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  Weekly view
                </Link>
              }
            />
            <ScheduleList entries={todayClasses} emptyText="You have no classes scheduled today." />
          </Card>

          <Card>
            <CardHeader
              title="Mentor group activity"
              description="Latest conversations in your groups"
              icon={<MessagesSquare className="h-4 w-4" />}
              action={
                <Link href="/mentorloop" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  Open MentorLoop
                </Link>
              }
            />
            {groups.length ? (
              <ul className="divide-y divide-line">
                {groups.slice(0, 4).map((group) => (
                  <li key={group.id}>
                    <Link
                      href={`/mentorloop/${group.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                        <MessagesSquare className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{group.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {group.last_message ?? group.description}
                        </span>
                      </span>
                      {group.unread_count ? (
                        <Badge tone="orange">{group.unread_count} new</Badge>
                      ) : (
                        <span className="text-[10px] text-slate-400">{group.member_count} members</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<MessagesSquare className="h-5 w-5" />}
                title="No mentor groups yet"
                action={
                  <ButtonLink href="/mentorloop" size="sm" variant="secondary">
                    Create a group
                  </ButtonLink>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Assigned maintenance"
              description="Issues routed to you or awaiting triage"
              icon={<Wrench className="h-4 w-4" />}
              action={
                <Link href="/fixora" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  Open Fixora
                </Link>
              }
            />
            {maintenance.length ? (
              <ul className="divide-y divide-line">
                {maintenance.slice(0, 4).map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/fixora/${request.id}`}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          request.priority === "urgent"
                            ? "bg-red-500"
                            : request.priority === "high"
                              ? "bg-amber-500"
                              : "bg-slate-300"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{request.title}</span>
                        <span className="block text-[11px] text-muted">
                          {request.ticket_number} · {request.building} {request.room}
                        </span>
                      </span>
                      <Badge tone={request.status === "submitted" ? "blue" : "navy"}>
                        {request.status.replace("_", " ")}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No assigned issues" />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Campus announcements"
              icon={<Megaphone className="h-4 w-4" />}
              action={
                <Link href="/announcements" className="text-[11px] font-semibold text-brand-blue hover:underline">
                  Publish
                </Link>
              }
            />
            <AnnouncementsList announcements={announcements} />
          </Card>

          <Card>
            <CardHeader title="Upcoming opportunities" icon={<Trophy className="h-4 w-4" />} />
            {deadlines.length ? (
              <ul className="divide-y divide-line">
                {deadlines.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <Link href={`/opportune/${item.id}`}>
                      <p className="truncate text-xs font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {item.organization} · closes {formatDate(item.deadline)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Trophy className="h-5 w-5" />} title="Nothing upcoming" />
            )}
          </Card>

          <Card className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Faculty workspace</p>
            <div className="mt-3 space-y-2">
              {[
                { href: "/timegrid", label: "Request a timetable correction", icon: CalendarDays },
                { href: "/announcements", label: "Publish an academic notice", icon: Megaphone },
                { href: "/opportune", label: "Share an opportunity", icon: Trophy },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <item.icon className="h-3.5 w-3.5 text-brand-blue" />
                  {item.label}
                  <ArrowRight className="ml-auto h-3 w-3 text-slate-400" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function AdminDashboard({ profile }: { profile: Profile }) {
  const [stats, announcements] = await Promise.all([getAdminStats(), listAnnouncements(profile, 3)]);

  const printData = Object.entries(stats.printStatus).map(([name, value]) => ({ name, value }));
  const maintenanceData = Object.entries(stats.maintenanceStatus).map(([name, value]) => ({
    label: name.replace("_", " "),
    count: value,
  }));

  return (
    <div>
      <PageIntro profile={profile} />

      <ModuleGrid
        counts={{
          printpulse: `${stats.activePrint} active`,
          timegrid: "Manage schedule",
          mentorloop: `${stats.groups} groups`,
          opportune: `${stats.upcomingOpportunities} live`,
          fixora: `${stats.pendingMaintenance} pending`,
        }}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={stats.users}
          hint={`${stats.students} students · ${stats.faculty} faculty`}
          icon={<Users className="h-5 w-5" />}
          tone="blue"
          href="/admin/users"
        />
        <StatCard
          label="Active print requests"
          value={stats.activePrint}
          hint={`${stats.readyPrint} awaiting collection`}
          icon={<Printer className="h-5 w-5" />}
          tone="orange"
          href="/printpulse"
        />
        <StatCard
          label="Pending maintenance"
          value={stats.pendingMaintenance}
          hint={`${stats.maintenanceStatus.resolved ?? 0} resolved overall`}
          icon={<Wrench className="h-5 w-5" />}
          tone="green"
          href="/fixora"
        />
        <StatCard
          label="Upcoming opportunities"
          value={stats.upcomingOpportunities}
          hint={`${stats.announcements} announcements published`}
          icon={<Trophy className="h-5 w-5" />}
          tone="amber"
          href="/opportune"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="Print request status"
            description={`${stats.totalPrint} total jobs · ${formatCurrency(stats.printRevenue)} estimated`}
            icon={<Printer className="h-4 w-4" />}
          />
          <div className="p-4">
            <DonutChart data={printData} colors={["#2563eb", "#14b8a6", "#f97316", "#22c55e", "#ef4444", "#64748b"]} />
            <div className="mt-2">
              <Legend data={printData} colors={["#2563eb", "#14b8a6", "#f97316", "#22c55e", "#ef4444", "#64748b"]} />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Maintenance pipeline"
            description="Complaints by workflow status across campus"
            icon={<Wrench className="h-4 w-4" />}
            action={
              <Link href="/fixora" className="text-[11px] font-semibold text-brand-blue hover:underline">
                Open queue
              </Link>
            }
          />
          <div className="p-4">
            {maintenanceData.length ? (
              <ColumnChart data={maintenanceData} dataKey="count" color="#14b8a6" />
            ) : (
              <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No complaints recorded" />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Operational shortcuts"
            description="Common administrator tasks"
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {[
              { href: "/printpulse", label: "Manage print queue & pricing", icon: Printer, desc: `${stats.activePrint} jobs active` },
              { href: "/timegrid", label: "Edit timetable & exams", icon: CalendarDays, desc: "Conflict-checked" },
              { href: "/fixora", label: "Assign maintenance requests", icon: Wrench, desc: `${stats.pendingMaintenance} open` },
              { href: "/admin/users", label: "Manage users & roles", icon: UserRound, desc: `${stats.users} accounts` },
              { href: "/announcements", label: "Publish official notices", icon: Megaphone, desc: "All audiences" },
              { href: "/opportune", label: "Publish opportunities", icon: Trophy, desc: `${stats.upcomingOpportunities} live` },
            ].map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="flex items-start gap-2.5 rounded-xl border border-line p-3 transition-colors hover:bg-slate-50"
              >
                <span className="rounded-lg bg-slate-50 p-1.5 text-slate-600">
                  <item.icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ink">{item.label}</span>
                  <span className="block text-[10px] text-muted">{item.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent audit activity"
            description="Privileged actions are recorded"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          {stats.auditLogs.length ? (
            <ul className="divide-y divide-line">
              {stats.auditLogs.slice(0, 6).map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <p className="text-[11px] font-semibold text-ink">{log.action.replace(/[._]/g, " ")}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {log.actor?.full_name ?? "System"} · {timeAgo(log.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No audit events yet" />
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader
            title="Recent announcements"
            description="Published to campus"
            icon={<Megaphone className="h-4 w-4" />}
            action={
              <Link href="/announcements" className="text-[11px] font-semibold text-brand-blue hover:underline">
                Publish new
              </Link>
            }
          />
          <AnnouncementsList announcements={announcements} />
        </Card>
      </div>
    </div>
  );
}
