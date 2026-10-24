import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Download,
  FileText,
  IndianRupee,
  Printer,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { PrintStatus } from "@/types";
import { requireProfile } from "@/lib/session";
import { getPrintRequest } from "@/lib/data/printpulse";
import { cancelPrintRequestAction } from "@/lib/actions/printpulse";
import { formatCurrency, formatDateTime, fileSizeLabel } from "@/lib/utils";
import { Alert, Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { PrintStatusBadge } from "@/components/modules/status-badge";
import { PrintStatusForm } from "../print-status-form";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Print job" };

const FLOW: { key: PrintStatus; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "queued", label: "Queued" },
  { key: "processing", label: "Processing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
];

export default async function PrintRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; cancelled?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const query = await searchParams;
  const request = await getPrintRequest(profile, id);
  if (!request) notFound();

  const isStaff = profile.role !== "student";
  const canCancel =
    profile.role === "student" &&
    request.student_id === profile.id &&
    ["submitted", "queued"].includes(request.status);
  const activeIndex = FLOW.findIndex((step) => step.key === request.status);
  const terminalFailure = request.status === "cancelled" || request.status === "failed";

  return (
    <div>
      <Link
        href="/printpulse"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to PrintPulse
      </Link>

      <PageHeader
        eyebrow={`PrintPulse · ${request.request_number}`}
        title={request.document_name}
        description={`Submitted ${formatDateTime(request.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RealtimeRefresh demo={isDemoMode()} table="print_requests" channelKey={`print-${request.id}`} />
            <PrintStatusBadge status={request.status} />
          </div>
        }
      />

      {query.error ? <Alert tone="error" className="mb-4">{query.error}</Alert> : null}
      {query.cancelled ? <Alert tone="warning" className="mb-4">This print request was cancelled.</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Request progress"
              description="Tracked by the print desk in real time"
              icon={<Printer className="h-4 w-4" />}
              action={<Badge tone="amber">Simulated output</Badge>}
            />
            <div className="p-5">
              {terminalFailure ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      {request.status === "cancelled" ? "Request cancelled" : "Print job failed"}
                    </p>
                    <p className="mt-1 text-xs text-red-700">
                      {request.status === "cancelled"
                        ? "This job was cancelled before printing started. You can submit a new request at any time."
                        : "The print desk marked this job as failed. Please contact the desk with your request number."}
                    </p>
                  </div>
                </div>
              ) : (
                <ol className="grid gap-2 sm:grid-cols-5">
                  {FLOW.map((step, index) => {
                    const done = activeIndex >= index;
                    const current = activeIndex === index;
                    return (
                      <li key={step.key} className="flex items-center gap-2 sm:flex-col sm:items-start">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
                          } ${current ? "ring-4 ring-emerald-100" : ""}`}
                        >
                          {done ? <BadgeCheck className="h-4 w-4" /> : index + 1}
                        </span>
                        <span className={`text-[11px] font-medium ${done ? "text-ink" : "text-slate-400"}`}>
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Queue estimate</p>
                  <p className="mt-0.5 text-xs font-medium text-ink">
                    {request.status === "ready" ? "Ready now" : "Based on job position"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Last update</p>
                  <p className="mt-0.5 text-xs font-medium text-ink">{formatDateTime(request.updated_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Print mode</p>
                  <p className="mt-0.5 text-xs font-medium capitalize text-ink">{request.print_mode} printing</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Document details"
              description="Visible only to you and authorized print staff"
              icon={<FileText className="h-4 w-4" />}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <dl className="space-y-2.5 text-xs">
                {[
                  ["Request number", request.request_number],
                  ["Pages", request.pages],
                  ["Page range", request.page_range ?? "All pages"],
                  ["Copies", request.copies],
                  ["Color", request.color_mode === "color" ? "Color" : "Black & white"],
                  ["Sides", request.sides === "double" ? "Double-sided" : "Single-sided"],
                  ["File size", fileSizeLabel(request.file_size)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-3">
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-3">
                <div className="rounded-xl bg-canvas p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <IndianRupee className="h-3 w-3" /> Estimated cost
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-ink">{formatCurrency(request.estimated_cost)}</p>
                  <p className="mt-1 text-[10px] capitalize text-muted">
                    Payment: {request.payment_status.replace("_", " ")} · {request.payment_method}
                  </p>
                  <p className="mt-2 text-[10px] text-muted">
                    Online payments are not connected in this deployment. Pay at the print desk
                    when you collect the job.
                  </p>
                </div>

                {!isDemoMode() && request.file_path ? (
                  <Link
                    href={`/api/printpulse/${request.id}/file`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[11px] font-semibold text-brand-blue hover:bg-blue-50"
                  >
                    <Download className="h-3.5 w-3.5" /> Open private PDF (signed link)
                  </Link>
                ) : (
                  <p className="rounded-lg border border-dashed border-line bg-slate-50 px-3 py-2 text-[10px] text-muted">
                    Demo mode stores only the file metadata. Connect Supabase Storage to upload and access the
                    PDF through a short-lived signed URL.
                  </p>
                )}

                <div className="flex items-start gap-1.5 text-[10px] text-muted">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  Print documents live in a private bucket. Access is limited to the owner and print desk staff.
                </div>
              </div>
            </div>
            {request.notes ? (
              <div className="border-t border-line px-5 py-3 text-xs">
                <span className="font-semibold text-slate-700">Print desk note:</span>{" "}
                <span className="text-muted">{request.notes}</span>
              </div>
            ) : null}
          </Card>

          {profile.role === "student" ? (
            <Card>
              <CardHeader title="Request actions" icon={<CalendarClock className="h-4 w-4" />} />
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="text-xs text-muted">
                  {canCancel
                    ? "You can cancel this job until the print desk starts processing it."
                    : "This job can no longer be cancelled."}
                </p>
                {canCancel ? (
                  <form action={cancelPrintRequestAction}>
                    <input type="hidden" name="id" value={request.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      <XCircle className="h-3.5 w-3.5" /> Cancel request
                    </Button>
                  </form>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Student"
              description={request.student ? request.student.email : "—"}
              icon={<FileText className="h-4 w-4" />}
            />
            <div className="p-5">
              <p className="text-sm font-semibold text-ink">{request.student?.full_name ?? "—"}</p>
              <p className="mt-0.5 text-xs text-muted">{request.student?.roll_number ?? "No roll number"}</p>
            </div>
          </Card>

          {isStaff && !terminalFailure ? (
            <Card>
              <CardHeader
                title="Update job status"
                description="The student is notified automatically"
                icon={<Printer className="h-4 w-4" />}
              />
              <PrintStatusForm request={request} />
            </Card>
          ) : null}

          {isStaff ? (
            <Card className="p-5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <Printer className="h-4 w-4" /> Physical printer not connected
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                CUPS/IPP integration is an optional module. Until a printer is configured and verified, status
                changes describe simulated output only.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
