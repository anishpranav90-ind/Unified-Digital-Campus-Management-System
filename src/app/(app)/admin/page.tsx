import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Megaphone,
  Printer,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { requireRole } from "@/lib/session";
import { getAdminStats, listAuditLogs } from "@/lib/data/admin";
import { getDailyPrintStats } from "@/lib/data/printpulse";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { ColumnChart, DonutChart, Legend } from "@/components/dashboard/charts";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Admin console" };

const SHORTCUTS = [
  { href: "/admin/users", label: "Users & roles", description: "Promote faculty, audit access", icon: UserRound },
  { href: "/printpulse", label: "Print operations", description: "Queue, statuses and pricing", icon: Printer },
  { href: "/timegrid", label: "Timetable & exams", description: "Conflict-checked scheduling", icon: CalendarDays },
  { href: "/fixora", label: "Maintenance workflow", description: "Assignment, priority, SLOs", icon: Wrench },
  { href: "/announcements", label: "Campus announcements", description: "Official notices", icon: Megaphone },
  { href: "/opportune", label: "Opportunities", description: "Publish and moderate listings", icon: Trophy },
];

const AUDIT_TONE: Record<string, string> = {
  "user.role_changed": "text-orange-600",
  "print.status_updated": "text-blue-600",
  "maintenance.updated": "text-emerald-600",
  "announcement.published": "text-violet-600",
};

export default async function AdminConsolePage() {
  await requireRole(["admin"]);
  const [stats, logs, daily] = await Promise.all([
    getAdminStats(),
    listAuditLogs(30),
    getDailyPrintStats(7),
  ]);

  const roleData = [
    { name: "Students", value: stats.students },
    { name: "Faculty", value: stats.faculty },
    { name: "Admins", value: stats.admins },
  ];
  const maintenanceData = Object.entries(stats.maintenanceStatus).map(([name, value]) => ({
    label: name.replace("_", " "),
    count: value,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Campus operations console"
        description="Every number on this page is read from the database. Role changes and privileged operations are audited."
        actions={
          <div className="flex items-center gap-2">
            <RealtimeRefresh demo={isDemoMode()} table="audit_logs" channelKey="audit" label="Live ops" />
            <Badge tone="navy"><ShieldCheck className="h-3 w-3" /> Administrator</Badge>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total accounts"
          value={stats.users}
          hint={`${stats.students} students · ${stats.faculty} faculty`}
          icon={<Users className="h-5 w-5" />}
          tone="blue"
          href="/admin/users"
        />
        <StatCard
          label="Print requests"
          value={stats.totalPrint}
          hint={`${stats.activePrint} active · ${formatCurrency(stats.printRevenue)} estimated`}
          icon={<Printer className="h-5 w-5" />}
          tone="orange"
          href="/printpulse"
        />
        <StatCard
          label="Open maintenance"
          value={stats.pendingMaintenance}
          hint={`${stats.maintenanceStatus.resolved ?? 0} resolved`}
          icon={<Wrench className="h-5 w-5" />}
          tone="green"
          href="/fixora"
        />
        <StatCard
          label="Live opportunities"
          value={stats.upcomingOpportunities}
          hint={`${stats.announcements} announcements`}
          icon={<Trophy className="h-5 w-5" />}
          tone="amber"
          href="/opportune"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Accounts by role" description="Role distribution" icon={<Users className="h-4 w-4" />} />
          <div className="p-4">
            <DonutChart data={roleData} colors={["#2563eb", "#14b8a6", "#f97316"]} />
            <div className="mt-2">
              <Legend data={roleData} colors={["#2563eb", "#14b8a6", "#f97316"]} />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Print volume — last 7 days"
            description="Jobs created per day"
            icon={<Activity className="h-4 w-4" />}
          />
          <div className="p-4">
            <ColumnChart data={daily} dataKey="jobs" color="#2563eb" height={230} />
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Management shortcuts"
            description="Jump to the operational surface you need"
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {SHORTCUTS.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="flex items-start gap-2.5 rounded-xl border border-line p-3 transition-colors hover:bg-slate-50"
              >
                <span className="rounded-lg bg-slate-50 p-1.5 text-slate-600">
                  <shortcut.icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-ink">{shortcut.label}</span>
                  <span className="block text-[10px] text-muted">{shortcut.description}</span>
                </span>
                <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Maintenance pipeline"
            description="Complaints by status"
            icon={<Wrench className="h-4 w-4" />}
          />
          <div className="p-4">
            {maintenanceData.length ? (
              <ColumnChart data={maintenanceData} dataKey="count" color="#14b8a6" height={220} />
            ) : (
              <p className="py-12 text-center text-xs text-muted">No complaints yet.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Card>
          <CardHeader
            title="Audit log"
            description="Privileged actions across UniSync"
            icon={<ShieldCheck className="h-4 w-4" />}
            action={<Badge tone="slate">{logs.length} recent events</Badge>}
          />
          <div className="scroll-thin max-h-96 overflow-y-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Action</th>
                  <th className="px-5 py-2.5 font-semibold">Actor</th>
                  <th className="px-5 py-2.5 font-semibold">Entity</th>
                  <th className="px-5 py-2.5 font-semibold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className={`px-5 py-2.5 font-medium ${AUDIT_TONE[log.action] ?? "text-slate-700"}`}>
                      {log.action.replace(/[._]/g, " ")}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{log.actor?.full_name ?? "System"}</td>
                    <td className="px-5 py-2.5 text-[10px] text-muted">
                      {log.entity}
                      {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}…` : ""}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-[10px] text-muted">
                      {formatDateTime(log.created_at)}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted">
                      No privileged actions have been recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
        The service-role key is never exposed to the browser. Role changes go through a security-definer
        function; print and maintenance mutations re-check the caller&apos;s role on the server.
      </p>
    </div>
  );
}
