import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  MapPin,
  Plus,
  Search,
  Wrench,
} from "lucide-react";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import {
  getMaintenanceStats,
  isOverdue,
  listMaintenanceRequests,
} from "@/lib/data/fixora";
import { MAINTENANCE_CATEGORIES } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/utils";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatCard,
  TableShell,
} from "@/components/ui";
import { MaintenanceStatusBadge } from "@/components/modules/status-badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export const metadata = { title: "Fixora" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-slate-300",
  medium: "bg-brand-blue",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

export default async function FixoraPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; overdue?: string; q?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const status = params.status ?? "all";
  const category = params.category ?? "all";
  const overdue = params.overdue === "1";
  const q = params.q ?? "";
  const isAdmin = profile.role === "admin";
  const isStaff = profile.role !== "student";

  const [requests, stats] = await Promise.all([
    listMaintenanceRequests(profile, { status, category, overdue, q }),
    isAdmin ? getMaintenanceStats() : Promise.resolve(null),
  ]);

  const open = requests.filter(
    (request) => !["resolved", "rejected"].includes(request.status),
  );
  const overdueCount = requests.filter((request) => isOverdue(request)).length;

  return (
    <div>
      <PageHeader
        eyebrow="Fixora · Campus maintenance"
        title={isAdmin ? "Maintenance control" : isStaff ? "Assigned maintenance" : "My complaints"}
        description={
          isAdmin
            ? "Assign complaints, set priorities, record progress and monitor resolution times."
            : isStaff
              ? "Issues assigned to you and new reports awaiting triage."
              : "Report campus issues and follow every update from submission to resolution."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RealtimeRefresh
              demo={isDemoMode()}
              table="maintenance_requests"
              channelKey="maintenance"
              label="Updates live"
            />
            {profile.role === "student" ? (
              <ButtonLink href="/fixora/new" size="sm" variant="accent">
                <Plus className="h-3.5 w-3.5" /> Report an issue
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open complaints"
          value={open.length}
          hint={`${requests.length} in current view`}
          icon={<Wrench className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="In progress"
          value={requests.filter((request) => request.status === "in_progress").length}
          hint="Work underway"
          icon={<Clock3 className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard
          label="Resolved"
          value={requests.filter((request) => request.status === "resolved").length}
          hint={stats ? `Avg ${stats.averageResolutionHours}h to resolve` : "Closed with a resolution trail"}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          hint="Open beyond the service target"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <Card className="mt-5">
        <form method="GET" className="flex flex-col gap-2 p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search ticket number, title or building…"
              className="pl-9"
              aria-label="Search complaints"
            />
          </div>
          <Select name="status" defaultValue={status} aria-label="Status filter" className="sm:w-40">
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </Select>
          <Select name="category" defaultValue={category} aria-label="Category filter" className="sm:w-52">
            <option value="all">All categories</option>
            {MAINTENANCE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          {isStaff ? (
            <label className="flex items-center gap-2 rounded-xl border border-line px-3 text-xs text-slate-600">
              <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="h-3.5 w-3.5 accent-amber-500" />
              Overdue
            </label>
          ) : null}
          <Button type="submit" variant="primary">
            <Filter className="h-3.5 w-3.5" /> Apply
          </Button>
        </form>
        <div className="scroll-thin flex gap-1.5 overflow-x-auto border-t border-line px-3 py-2">
          {FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={`/fixora${filter.value === "all" ? "" : `?status=${filter.value}`}`}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                status === filter.value
                  ? "bg-navy-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </Card>

      <div className={`mt-5 grid gap-4 ${isAdmin && stats ? "lg:grid-cols-3" : ""}`}>
        <div className={isAdmin && stats ? "lg:col-span-2" : ""}>
          {requests.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Wrench className="h-5 w-5" />}
                title="No complaints found"
                description={
                  status === "all"
                    ? profile.role === "student"
                      ? "Report an issue to start tracking it here."
                      : "No maintenance complaints match this view."
                    : "Try another status or clear the filters."
                }
                action={
                  profile.role === "student" ? (
                    <ButtonLink href="/fixora/new" size="sm" variant="accent">
                      <Plus className="h-3.5 w-3.5" /> Report an issue
                    </ButtonLink>
                  ) : undefined
                }
              />
            </Card>
          ) : isAdmin ? (
            <Card className="overflow-hidden">
              <CardHeader
                title="Complaint queue"
                description={`${requests.length} complaints`}
                icon={<Wrench className="h-4 w-4" />}
              />
              <TableShell className="rounded-none border-0">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Ticket</th>
                    <th className="px-4 py-3 font-semibold">Issue</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Assigned</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {requests.map((request) => (
                    <tr key={request.id} className={`text-xs ${isOverdue(request) ? "bg-red-50/40" : ""}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                        {request.ticket_number}
                        {isOverdue(request) ? (
                          <span className="ml-1.5 rounded bg-red-100 px-1 py-0.5 text-[8px] font-bold uppercase text-red-700">
                            Overdue
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-52 px-4 py-3">
                        <p className="truncate font-medium text-ink">{request.title}</p>
                        <p className="text-[10px] text-muted">{request.category}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-600">
                        {request.building} · {request.room}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold capitalize text-slate-600">
                          <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_COLOR[request.priority]}`} />
                          {request.priority}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <MaintenanceStatusBadge status={request.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-600">
                        {request.assignee?.full_name ?? request.assigned_to ?? "Unassigned"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/fixora/${request.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-brand-blue hover:bg-blue-50"
                        >
                          Manage <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <Card key={request.id} className="transition-shadow hover:shadow-lift">
                  <div className="flex items-start gap-3 p-4">
                    <span className={`mt-1 h-9 w-1 shrink-0 rounded-full ${PRIORITY_COLOR[request.priority]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{request.title}</p>
                        <MaintenanceStatusBadge status={request.status} />
                        {isOverdue(request) ? <Badge tone="red">Overdue</Badge> : null}
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {request.ticket_number} · {request.category}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {request.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {request.building}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {request.room}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" /> {formatDate(request.created_at)}
                        </span>
                      </div>
                      {isStaff ? (
                        <p className="mt-2 text-[10px] text-slate-500">
                          Reported by {request.student?.full_name ?? "student"} · Assigned to{" "}
                          {request.assignee?.full_name ?? "unassigned"}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/fixora/${request.id}`}
                      className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-brand-blue"
                    >
                      Track <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {isAdmin && stats ? (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Resolution health" description="Service-level overview" icon={<CheckCircle2 className="h-4 w-4" />} />
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Total complaints</span>
                  <span className="font-semibold text-ink">{stats.total}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Overdue</span>
                  <span className="font-semibold text-red-600">{stats.overdue}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Average resolution</span>
                  <span className="font-semibold text-ink">{stats.averageResolutionHours} hours</span>
                </div>
                <div className="mt-2 space-y-2 border-t border-line pt-3">
                  {Object.entries(stats.byStatus).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-[10px]">
                      <span className="w-24 shrink-0 capitalize text-slate-600">{key.replace("_", " ")}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-teal"
                          style={{ width: `${Math.round((value / Math.max(1, stats.total)) * 100)}%` }}
                        />
                      </div>
                      <span className="w-5 text-right font-semibold text-ink">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Complaints by category" icon={<Wrench className="h-4 w-4" />} />
              <ul className="divide-y divide-line">
                {Object.entries(stats.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([name, value]) => (
                    <li key={name} className="flex items-center justify-between px-5 py-2.5 text-[11px]">
                      <span className="text-slate-600">{name}</span>
                      <span className="font-semibold text-ink">{value}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        ) : null}
      </div>

      <p className="mt-6 text-[10px] text-muted">
        Last refreshed {timeAgo(new Date().toISOString())}. Complaint status changes are stored in an
        immutable history table and the student is notified for each update.
      </p>
    </div>
  );
}
