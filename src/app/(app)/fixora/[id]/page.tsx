import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import {
  getMaintenancePhotoUrl,
  getMaintenanceRequest,
  isOverdue,
  listAssigneeCandidates,
} from "@/lib/data/fixora";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
} from "@/components/ui";
import { MaintenanceStatusBadge } from "@/components/modules/status-badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { MaintenanceUpdateForm } from "../maintenance-update-form";
import { CommentForm } from "../comment-form";

export const metadata = { title: "Complaint" };

const PRIORITY_TONE: Record<string, "slate" | "blue" | "amber" | "red"> = {
  low: "slate",
  medium: "blue",
  high: "amber",
  urgent: "red",
};

export default async function MaintenanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const query = await searchParams;
  const detail = await getMaintenanceRequest(profile, id);
  if (!detail) notFound();

  const isAdmin = profile.role === "admin";
  const [photoUrl, resolutionUrl, assignees] = await Promise.all([
    getMaintenancePhotoUrl(detail.request.photo_path),
    getMaintenancePhotoUrl(detail.request.resolution_photo_path),
    isAdmin ? listAssigneeCandidates() : Promise.resolve([]),
  ]);

  const overdue = isOverdue(detail.request);

  return (
    <div>
      <Link
        href="/fixora"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Fixora
      </Link>

      <PageHeader
        eyebrow={`Fixora · ${detail.request.ticket_number}`}
        title={detail.request.title}
        description={`Reported ${formatDateTime(detail.request.created_at)} · ${detail.request.category}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RealtimeRefresh
              demo={isDemoMode()}
              table="maintenance_requests"
              channelKey={`maintenance-${detail.request.id}`}
            />
            <Badge tone={PRIORITY_TONE[detail.request.priority]}>
              {detail.request.priority} priority
            </Badge>
            <MaintenanceStatusBadge status={detail.request.status} />
          </div>
        }
      />

      {query.submitted ? (
        <Alert tone="success" className="mb-4">
          Complaint <strong>{detail.request.ticket_number}</strong> submitted. Facilities will review it and
          you will be notified of every status change.
        </Alert>
      ) : null}
      {overdue ? (
        <Alert tone="warning" className="mb-4">
          This complaint is beyond the service target. It has been flagged as overdue for the facilities team.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Reported issue" icon={<Wrench className="h-4 w-4" />} />
            <div className="space-y-4 p-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {detail.request.description}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-[9px] uppercase tracking-wide text-muted">Building</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-ink">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" /> {detail.request.building}
                  </p>
                </div>
                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-[9px] uppercase tracking-wide text-muted">Location</p>
                  <p className="mt-0.5 text-xs font-medium text-ink">{detail.request.room}</p>
                </div>
                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-[9px] uppercase tracking-wide text-muted">Reported by</p>
                  <p className="mt-0.5 text-xs font-medium text-ink">
                    {detail.request.student?.full_name ?? "Student"}
                  </p>
                </div>
              </div>

              {photoUrl ? (
                <div className="overflow-hidden rounded-xl border border-line">
                  <Image
                    src={photoUrl}
                    alt="Complaint attachment"
                    width={900}
                    height={500}
                    unoptimized
                    className="max-h-80 w-full object-cover"
                  />
                </div>
              ) : detail.request.photo_path ? (
                <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-line bg-slate-50 px-3 py-2 text-[10px] text-muted">
                  <Paperclip className="h-3 w-3" /> Photo attached. Signed access is available once Supabase
                  Storage is configured (demo mode stores metadata only).
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Complaint history"
              description="Every status change is recorded with actor and note"
              icon={<CalendarClock className="h-4 w-4" />}
            />
            <ol className="space-y-0 p-5">
              {detail.history.map((entry, index) => (
                <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < detail.history.length - 1 ? (
                    <span className="absolute left-[11px] top-6 h-full w-px bg-line" aria-hidden />
                  ) : null}
                  <span
                    className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      entry.status === "resolved"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {entry.status === "resolved" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <MaintenanceStatusBadge status={entry.status} />
                      <span className="text-[10px] text-muted">{formatDateTime(entry.created_at)}</span>
                    </div>
                    {entry.note ? <p className="mt-1 text-xs leading-relaxed text-slate-700">{entry.note}</p> : null}
                    <p className="mt-1 text-[10px] text-slate-400">
                      {entry.actor?.full_name ?? "Facilities team"} · {timeAgo(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader
              title={`Comments (${detail.comments.length})`}
              description="Visible conversation about this complaint"
              icon={<MessageSquare className="h-4 w-4" />}
            />
            {detail.comments.length ? (
              <ul className="divide-y divide-line">
                {detail.comments.map((comment) => (
                  <li key={comment.id} className="flex gap-3 px-5 py-4">
                    <Avatar name={comment.author?.full_name ?? "User"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-ink">{comment.author?.full_name ?? "User"}</p>
                        {comment.is_internal ? <Badge tone="amber">Internal</Badge> : null}
                        <span className="text-[10px] text-muted">{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">{comment.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-xs text-muted">No comments yet.</p>
            )}
            {detail.request.status !== "rejected" ? (
              <div className="border-t border-line">
                <CommentForm requestId={detail.request.id} isStaff={profile.role !== "student"} />
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Resolution details" icon={<ShieldCheck className="h-4 w-4" />} />
            <dl className="space-y-2.5 p-5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Status</dt>
                <dd><MaintenanceStatusBadge status={detail.request.status} /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Priority</dt>
                <dd className="font-medium capitalize text-ink">{detail.request.priority}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Assigned to</dt>
                <dd className="text-right font-medium text-ink">
                  {detail.request.assignee?.full_name ?? "Unassigned"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Created</dt>
                <dd className="font-medium text-ink">{formatDate(detail.request.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Last update</dt>
                <dd className="font-medium text-ink">{formatDate(detail.request.updated_at)}</dd>
              </div>
              {detail.request.resolved_at ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Resolved</dt>
                  <dd className="font-medium text-ink">{formatDate(detail.request.resolved_at)}</dd>
                </div>
              ) : null}
            </dl>
            {detail.request.resolution_note ? (
              <div className="border-t border-line p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolution note
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">{detail.request.resolution_note}</p>
                {resolutionUrl ? (
                  <Image
                    src={resolutionUrl}
                    alt="Resolution evidence"
                    width={500}
                    height={300}
                    unoptimized
                    className="mt-2 max-h-40 w-full rounded-lg object-cover"
                  />
                ) : null}
              </div>
            ) : null}
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader
                title="Workflow update"
                description="Assignment and status changes are audited"
                icon={<Wrench className="h-4 w-4" />}
              />
              <MaintenanceUpdateForm request={detail.request} assignees={assignees} />
            </Card>
          ) : profile.role === "faculty" ? (
            <Card className="p-5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold text-ink">You are viewing as assigned staff</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">
                    You can add comments and progress notes. Only administrators can change the official
                    status, priority or assignment.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="flex items-start gap-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                <div>
                  <p className="text-xs font-semibold text-ink">Transparent tracking</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">
                    Only you and the facilities team can see this complaint. You will receive an in-app
                    notification whenever it is assigned, updated or resolved.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
