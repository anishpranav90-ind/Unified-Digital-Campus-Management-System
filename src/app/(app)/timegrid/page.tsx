import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardPenLine,
  Clock,
  DoorOpen,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import {
  getAllTimetableEntries,
  getExamSchedule,
  getTimetable,
  getTimetableReferenceData,
  listTimetableCorrections,
} from "@/lib/data/timegrid";
import {
  deleteExamAction,
  deleteTimetableEntryAction,
  resolveCorrectionAction,
  toggleTimetablePublishedAction,
} from "@/lib/actions/timegrid";
import { dayName, formatDate, formatTime, minutesFromTime, todayDayNumber } from "@/lib/utils";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  TableShell,
} from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TimetableEntryForm } from "./timetable-entry-form";
import { ExamForm } from "./exam-form";
import { CorrectionForm } from "./correction-form";

export const metadata = { title: "TimeGrid" };

const DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

function weekDates() {
  const now = new Date();
  const current = now.getDay();
  const mondayOffset = current === 0 ? -6 : 1 - current;
  return DAYS.map((day) => {
    const date = new Date(now);
    date.setDate(now.getDate() + mondayOffset + (day.value - 1));
    return { ...day, date };
  });
}

export default async function TimeGridPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const isAdmin = profile.role === "admin";
  const isFaculty = profile.role === "faculty";

  const [timetable, exams, reference, corrections] = await Promise.all([
    getTimetable(profile),
    getExamSchedule(profile),
    isAdmin ? getTimetableReferenceData() : Promise.resolve(null),
    isAdmin ? listTimetableCorrections(profile) : Promise.resolve([]),
  ]);
  const adminEntries = isAdmin ? await getAllTimetableEntries(profile) : timetable;
  const entries = isAdmin ? adminEntries.filter((entry) => entry.published) : timetable;
  const editingEntry = isAdmin && params.edit ? adminEntries.find((entry) => entry.id === params.edit) : null;

  const today = todayDayNumber();
  const todayClasses = entries
    .filter((entry) => entry.day_of_week === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const upcomingToday = todayClasses.filter((entry) => minutesFromTime(entry.end_time) >= nowMinutes);
  const nextClass = upcomingToday[0];
  const subjectIds = Array.from(new Set(entries.map((entry) => entry.subject?.id).filter(Boolean)));
  const legend = subjectIds
    .map((id) => entries.find((entry) => entry.subject?.id === id)?.subject)
    .filter(Boolean);
  const dates = weekDates();

  return (
    <div>
      <PageHeader
        eyebrow="TimeGrid · Timetable hub"
        title="Weekly timetable"
        description={
          isAdmin
            ? "Create, publish and conflict-check the campus timetable and examination schedule."
            : isFaculty
              ? "Your teaching schedule, classrooms and the examination calendar."
              : "Your week at a glance, with today's classes and published schedule updates."
        }
        actions={<RealtimeRefresh demo={isDemoMode()} table="timetable_entries" channelKey="timetable" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Classes this week"
          value={entries.length}
          hint={`${todayClasses.length} scheduled today`}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Next class"
          value={nextClass ? formatTime(nextClass.start_time) : "n/a"}
          hint={nextClass ? `${nextClass.subject?.code} · ${nextClass.classroom?.name}` : "Nothing left today"}
          icon={<Clock className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard
          label="Subjects"
          value={legend.length}
          hint="Colour-coded on the calendar"
          icon={<BookOpen className="h-5 w-5" />}
          tone="teal"
        />
        <StatCard
          label="Upcoming exams"
          value={exams.length}
          hint={exams[0] ? `${exams[0].subject?.code} on ${formatDate(exams[0].exam_date)}` : "None scheduled"}
          icon={<CalendarRange className="h-5 w-5" />}
          tone="amber"
          href="#exams"
        />
      </div>

      {nextClass ? (
        <Card className="mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 bg-navy-950 px-5 py-4 text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
              <Clock className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Up next today</p>
              <p className="mt-0.5 truncate text-sm font-semibold">
                {nextClass.subject?.name} · {formatTime(nextClass.start_time)}–{formatTime(nextClass.end_time)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {nextClass.classroom?.name}, {nextClass.classroom?.building} · {nextClass.faculty?.full_name}
              </p>
            </div>
            <Badge tone="orange">{dayName(today)}</Badge>
          </div>
        </Card>
      ) : null}

      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">Weekly schedule</h2>
            <p className="text-xs text-muted">
              {isAdmin ? "Includes unpublished entries, marked below." : "Published by the timetable office."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {legend.map((subject) =>
              subject ? (
                <span key={subject.id} className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject.color }} />
                  {subject.code}
                </span>
              ) : null,
            )}
          </div>
        </div>

        <div className="scroll-thin overflow-x-auto pb-2">
          <div className="grid min-w-[900px] grid-cols-6 gap-2">
            {dates.map((day) => {
              const dayEntries = (isAdmin ? adminEntries : entries)
                .filter((entry) => entry.day_of_week === day.value)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
              const isToday = day.value === today;
              return (
                <div
                  key={day.value}
                  className={`rounded-2xl border bg-white p-2.5 ${
                    isToday ? "border-brand-orange/40 ring-1 ring-brand-orange/10" : "border-line"
                  }`}
                >
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <div>
                      <p className={`text-[11px] font-semibold ${isToday ? "text-brand-orange" : "text-ink"}`}>
                        {day.label}
                      </p>
                      <p className="text-[9px] text-muted">
                        {day.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    {isToday ? <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" /> : null}
                  </div>
                  <div className="space-y-1.5">
                    {dayEntries.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-[9px] text-slate-400">
                        No classes
                      </p>
                    ) : (
                      dayEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded-lg border border-line/80 bg-slate-50/60 p-2 ${
                            !entry.published ? "opacity-60" : ""
                          }`}
                          style={{ borderLeft: `3px solid ${entry.subject?.color ?? "#94a3b8"}` }}
                        >
                          <p className="text-[9px] font-semibold text-slate-500">
                            {formatTime(entry.start_time)}–{formatTime(entry.end_time)}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-tight text-ink">
                            {entry.subject?.name ?? "Class"}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-[8px] text-muted">
                            <MapPin className="h-2.5 w-2.5" /> {entry.classroom?.name}
                          </p>
                          <p className="flex items-center gap-1 truncate text-[8px] text-muted">
                            <UserRound className="h-2.5 w-2.5" /> {entry.faculty?.full_name}
                          </p>
                          {!entry.published ? (
                            <span className="mt-1 inline-block rounded bg-amber-100 px-1 py-0.5 text-[7px] font-bold uppercase text-amber-700">
                              Draft
                            </span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2" id="exams">
        <Card>
          <CardHeader
            title="Examination schedule"
            description="Published exam dates, rooms and session times"
            icon={<CalendarRange className="h-4 w-4" />}
            action={<Badge tone="amber">{exams.length} exams</Badge>}
          />
          {exams.length === 0 ? (
            <EmptyState icon={<CalendarRange className="h-5 w-5" />} title="No exams scheduled" />
          ) : (
            <ul className="divide-y divide-line">
              {exams.map((exam) => (
                <li key={exam.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-[9px] font-bold uppercase text-slate-500">
                    <span className="text-sm leading-none text-ink">
                      {new Date(exam.exam_date).getDate()}
                    </span>
                    {new Date(exam.exam_date).toLocaleDateString("en-IN", { month: "short" })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{exam.subject?.name ?? "Exam"}</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {exam.subject?.code} · {formatTime(exam.start_time)}–{formatTime(exam.end_time)} ·{" "}
                      {exam.room}
                    </p>
                    <Badge tone="slate" className="mt-1.5 capitalize">
                      {exam.exam_type.replace("_", " ")}
                    </Badge>
                  </div>
                  {isAdmin ? (
                    <form action={deleteExamAction}>
                      <input type="hidden" name="id" value={exam.id} />
                      <button
                        type="submit"
                        aria-label="Delete exam"
                        className="rounded-lg border border-line p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isAdmin && reference ? (
          <Card>
            <CardHeader title="Add examination" description="Visible to students immediately" icon={<Plus className="h-4 w-4" />} />
            <ExamForm subjects={reference.subjects} />
          </Card>
        ) : isFaculty ? (
          <Card>
            <CardHeader
              title="Request a timetable correction"
              description="Reviewed by the timetable office"
              icon={<ClipboardPenLine className="h-4 w-4" />}
            />
            <CorrectionForm entries={entries} />
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="Schedule change notifications"
              description="You will be notified when the timetable office publishes a change."
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <div className="space-y-2 p-5 text-xs text-muted">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                Only published timetable entries are shown to students.
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                Classroom and faculty conflicts are blocked at the database layer.
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                Examination dates appear here as soon as they are published.
              </p>
            </div>
          </Card>
        )}
      </div>

      {isAdmin && reference ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3" id="editor">
          <Card className="h-fit">
            <CardHeader
              title={editingEntry ? "Edit timetable entry" : "Add a class"}
              description="Conflicts are validated before saving"
              icon={editingEntry ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              action={
                editingEntry ? (
                  <Link href="/timegrid#editor" className="text-[10px] font-semibold text-brand-blue">
                    Cancel edit
                  </Link>
                ) : null
              }
            />
            <TimetableEntryForm
              subjects={reference.subjects}
              classrooms={reference.classrooms}
              faculty={reference.faculty}
              entry={editingEntry}
            />
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title="Timetable entries"
              description={`${adminEntries.length} entries · publish drafts when ready`}
              icon={<CalendarRange className="h-4 w-4" />}
            />
            <TableShell className="rounded-none border-0">
              <thead>
                <tr className="border-b border-line bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Slot</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Room</th>
                  <th className="px-4 py-3 font-semibold">Faculty</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {adminEntries.map((entry) => (
                  <tr key={entry.id} className="text-xs">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <p className="font-medium text-ink">{dayName(entry.day_of_week).slice(0, 3)}</p>
                      <p className="text-[10px] text-muted">{formatTime(entry.start_time)}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink">{entry.subject?.code}</p>
                      <p className="text-[10px] text-muted">Sem {entry.semester} · {entry.section}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{entry.classroom?.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{entry.faculty?.full_name}</td>
                    <td className="px-4 py-2.5">
                      {entry.published ? <Badge tone="green">Published</Badge> : <Badge tone="amber">Draft</Badge>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/timegrid?edit=${entry.id}#editor`}
                          className="rounded-lg border border-line p-1.5 text-slate-500 hover:bg-slate-50"
                          aria-label="Edit entry"
                        >
                          <Pencil className="h-3 w-3" />
                        </Link>
                        <form action={toggleTimetablePublishedAction}>
                          <input type="hidden" name="id" value={entry.id} />
                          <input type="hidden" name="published" value={String(!entry.published)} />
                          <button
                            type="submit"
                            className="rounded-lg border border-line p-1.5 text-slate-500 hover:bg-slate-50"
                            aria-label={entry.published ? "Unpublish entry" : "Publish entry"}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </button>
                        </form>
                        <form action={deleteTimetableEntryAction}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-line p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Delete entry"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Card>
        </div>
      ) : null}

      {isAdmin && corrections.length ? (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="Timetable correction requests"
              description="Submitted by faculty"
              icon={<ClipboardPenLine className="h-4 w-4" />}
              action={<Badge tone="orange">{corrections.filter((item) => item.status === "pending").length} pending</Badge>}
            />
            <ul className="divide-y divide-line">
              {corrections.map((correction) => (
                <li key={correction.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink">
                      {correction.entry?.subject?.name ?? "Timetable entry"} ·{" "}
                      {correction.entry ? dayName(correction.entry.day_of_week) : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">{correction.reason}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {correction.requester?.full_name ?? "Faculty"} ·{" "}
                      {correction.status === "resolved" ? "Resolved" : "Pending"}
                      {correction.admin_note ? ` · ${correction.admin_note}` : ""}
                    </p>
                  </div>
                  {correction.status === "pending" ? (
                    <form action={resolveCorrectionAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={correction.id} />
                      <input
                        name="note"
                        placeholder="Resolution note"
                        className="focus-ring h-8 w-40 rounded-lg border border-line px-2 text-[10px]"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-navy-900 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-navy-800"
                      >
                        Resolve
                      </button>
                    </form>
                  ) : (
                    <Badge tone="green">Resolved</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <p className="mt-6 flex items-center gap-1.5 text-[10px] text-muted">
        <DoorOpen className="h-3.5 w-3.5" /> Classroom bookings are checked across the academic year. Faculty
        double-bookings are rejected by a database trigger as well as server validation.
      </p>
    </div>
  );
}
