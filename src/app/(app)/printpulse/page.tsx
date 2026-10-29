import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  IndianRupee,
  Layers,
  Plus,
  Printer,
  Settings2,
  Timer,
  Truck,
} from "lucide-react";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import {
  getDailyPrintStats,
  getPrintQueueInfo,
  getPrintSettings,
  listPrintRequests,
} from "@/lib/data/printpulse";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/utils";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  FilterPill,
  PageHeader,
  StatCard,
  TableShell,
} from "@/components/ui";
import { PrintStatusBadge } from "@/components/modules/status-badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ColumnChart } from "@/components/dashboard/charts";
import { PrintSettingsForm } from "./settings-form";

export const metadata = { title: "PrintPulse" };

const STATUS_FILTERS = [
  { value: "all", label: "All requests" },
  { value: "submitted", label: "Submitted" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
];

export default async function PrintPulsePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const status = params.status ?? "all";
  const isStaff = profile.role !== "student";

  const [settings, queue, requests] = await Promise.all([
    getPrintSettings(),
    getPrintQueueInfo(profile),
    listPrintRequests(profile, { status, limit: 100 }),
  ]);
  const daily = isStaff ? await getDailyPrintStats(7) : [];

  return (
    <div>
      <PageHeader
        eyebrow="PrintPulse · Smart printout queue"
        title={isStaff ? "Print desk" : "Print queue"}
        description={
          isStaff
            ? "Manage the campus print queue, update job statuses and configure pricing."
            : "Upload PDFs, see the estimated cost and track your position in the queue."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RealtimeRefresh
              demo={isDemoMode()}
              table="print_requests"
              channelKey="print-requests"
              label="Queue live"
            />
            {profile.role === "student" ? (
              <ButtonLink href="/printpulse/new" size="sm" variant="accent">
                <Plus className="h-3.5 w-3.5" /> New print job
              </ButtonLink>
            ) : (
              <Badge tone="amber">
                <Printer className="h-3 w-3" /> Printer mode: {settings.printer_mode}
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="In queue"
          value={queue.pending}
          hint={`${queue.processing} currently printing`}
          icon={<Layers className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label={isStaff ? "Average processing" : "Your queue position"}
          value={isStaff ? `${settings.avg_processing_minutes} min` : queue.position ? `#${queue.position}` : "Not set"}
          hint={
            isStaff
              ? `${settings.max_pages_per_job} page limit per job`
              : queue.position
                ? `Estimated wait ~${queue.estimated_wait_minutes} min`
                : "No active job in the queue"
          }
          icon={isStaff ? <Timer className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard
          label="Ready for collection"
          value={requests.filter((request) => request.status === "ready").length}
          hint="Waiting at the print desk"
          icon={<Truck className="h-5 w-5" />}
          tone="teal"
        />
        <StatCard
          label="Completed jobs"
          value={requests.filter((request) => request.status === "completed").length}
          hint="In the current view"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
        />
      </div>

      <div className={`mt-5 grid gap-4 ${isStaff ? "lg:grid-cols-3" : "lg:grid-cols-[1.4fr_1fr]"}`}>
        <Card className="lg:col-span-2">
          <CardHeader
            title="How the queue works"
            description="Estimated waiting time = jobs ahead × average processing time"
            icon={<Printer className="h-4 w-4" />}
            action={<Badge tone="slate">Simulated printer</Badge>}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-xl bg-canvas p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Waiting</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{queue.pending}</p>
              <p className="text-[10px] text-muted">submitted + queued jobs</p>
            </div>
            <div className="rounded-xl bg-canvas p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Printing</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{queue.processing}</p>
              <p className="text-[10px] text-muted">jobs currently processing</p>
            </div>
            <div className="rounded-xl bg-canvas p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Pricing</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                ₹{settings.bw_single}/₹{settings.color_single} per page
              </p>
              <p className="text-[10px] text-muted">B&W / color · single-sided</p>
            </div>
          </div>
          <p className="border-t border-line px-5 py-3 text-[10px] text-amber-700">
            No physical printer is connected. Jobs are marked as simulated output; the print desk updates the
            digital queue only.
          </p>
        </Card>

        <Card>
          <CardHeader
            title={isStaff ? "Daily print volume" : "Your next step"}
            icon={isStaff ? <IndianRupee className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          />
          <div className="p-4">
            {isStaff ? (
              <ColumnChart data={daily} dataKey="jobs" color="#f97316" height={200} />
            ) : queue.position ? (
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Position</p>
                <p className="mt-1 text-4xl font-semibold text-brand-orange">#{queue.position}</p>
                <p className="mt-1 text-xs text-muted">
                  About {queue.estimated_wait_minutes} minutes based on {settings.avg_processing_minutes} min
                  per job.
                </p>
                <ButtonLink href="/printpulse/new" size="sm" variant="secondary" className="mt-4">
                  <Plus className="h-3.5 w-3.5" /> Add another job
                </ButtonLink>
              </div>
            ) : (
              <EmptyState
                icon={<Printer className="h-5 w-5" />}
                title="You're not in the queue"
                description="Submit a PDF to get a request number and live position."
                action={
                  <ButtonLink href="/printpulse/new" size="sm" variant="accent">
                    New print job
                  </ButtonLink>
                }
              />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">{isStaff ? "All print requests" : "My print requests"}</h2>
            <p className="text-xs text-muted">{requests.length} request{requests.length === 1 ? "" : "s"} in this view</p>
          </div>
          <div className="scroll-thin flex max-w-full gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((filter) => (
              <FilterPill
                key={filter.value}
                href={`/printpulse${filter.value === "all" ? "" : `?status=${filter.value}`}`}
                active={status === filter.value}
              >
                {filter.label}
              </FilterPill>
            ))}
          </div>
        </div>

        {requests.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Printer className="h-5 w-5" />}
              title="No print requests found"
              description={status === "all" ? "Submit your first PDF to start using PrintPulse." : "Try a different status filter."}
              action={
                profile.role === "student" ? (
                  <ButtonLink href="/printpulse/new" size="sm" variant="accent">
                    New print job
                  </ButtonLink>
                ) : undefined
              }
            />
          </Card>
        ) : isStaff ? (
          <TableShell>
            <thead>
              <tr className="border-b border-line bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Request</th>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Options</th>
                <th className="px-4 py-3 font-semibold">Cost</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map((request) => (
                <tr key={request.id} className="text-xs hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{request.request_number}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-medium text-ink">{request.student?.full_name ?? "Student"}</p>
                    <p className="text-[10px] text-muted">{request.student?.roll_number ?? ""}</p>
                  </td>
                  <td className="max-w-56 px-4 py-3">
                    <p className="truncate font-medium text-ink">{request.document_name}</p>
                    <p className="text-[10px] text-muted">{request.pages} pages · {request.page_range ?? "all"}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-600">
                    {request.copies} cop{request.copies > 1 ? "ies" : "y"} · {request.color_mode === "color" ? "Color" : "B&W"} ·{" "}
                    {request.sides === "double" ? "Double" : "Single"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                    {formatCurrency(request.estimated_cost)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <PrintStatusBadge status={request.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[10px] text-muted">
                    {timeAgo(request.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/printpulse/${request.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-brand-blue hover:bg-blue-50"
                    >
                      Manage <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {requests.map((request) => (
              <Card key={request.id} className="p-5 transition-shadow hover:shadow-lift">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{request.document_name}</p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {request.request_number} · {formatDateTime(request.created_at)}
                    </p>
                  </div>
                  <PrintStatusBadge status={request.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span>{request.pages} pages</span>
                  <span>{request.copies} copies</span>
                  <span>{request.color_mode === "color" ? "Color" : "B&W"}</span>
                  <span>{request.sides === "double" ? "Double-sided" : "Single-sided"}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <p className="text-sm font-semibold text-ink">{formatCurrency(request.estimated_cost)}</p>
                  <Link
                    href={`/printpulse/${request.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue"
                  >
                    Track job <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {profile.role === "admin" ? (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="Print pricing & queue settings"
              description="Applies to all new print requests"
              icon={<Settings2 className="h-4 w-4" />}
              action={<Badge tone="navy">Admin only</Badge>}
            />
            <PrintSettingsForm settings={settings} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
