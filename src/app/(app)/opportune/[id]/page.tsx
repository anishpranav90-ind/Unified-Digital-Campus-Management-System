import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { requireProfile } from "@/lib/session";
import { getOpportunity } from "@/lib/data/opportune";
import { deleteOpportunityAction, toggleBookmarkAction } from "@/lib/actions/opportune";
import { daysUntil, formatDate, isPast, safeExternalUrl, timeAgo } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { OpportunityCategoryBadge } from "@/components/modules/status-badge";
import { ExternalLinkButton } from "../external-link-button";

export const metadata = { title: "Opportunity" };

function deadlineCopy(deadline: string) {
  const days = daysUntil(deadline);
  if (days === 0) return { label: "Closes today", tone: "red" as const };
  if (days <= 7) return { label: `${days} days left`, tone: "amber" as const };
  return { label: `${days} days left`, tone: "slate" as const };
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const opportunity = await getOpportunity(profile, id);
  if (!opportunity) notFound();

  const url = safeExternalUrl(opportunity.apply_url);
  const deadline = deadlineCopy(opportunity.deadline);
  const closed = isPast(opportunity.deadline);

  return (
    <div>
      <Link
        href="/opportune"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to opportunities
      </Link>

      <PageHeader
        eyebrow="Opportune"
        title={opportunity.title}
        description={`${opportunity.organization} · posted ${timeAgo(opportunity.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <OpportunityCategoryBadge category={opportunity.category} />
            <form action={toggleBookmarkAction}>
              <input type="hidden" name="opportunity_id" value={opportunity.id} />
              <button
                type="submit"
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${
                  opportunity.is_bookmarked
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-line bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opportunity.is_bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                {opportunity.is_bookmarked ? "Saved" : "Save"}
              </button>
            </form>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="About this opportunity" icon={<Building2 className="h-4 w-4" />} />
            <div className="space-y-4 p-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {opportunity.description}
              </p>
              {opportunity.tags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {opportunity.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Eligibility & requirements" icon={<Users className="h-4 w-4" />} />
            <div className="p-5 text-sm leading-relaxed text-slate-700">
              {opportunity.eligibility ?? "No specific eligibility was listed. Check the official application page for full details."}
            </div>
          </Card>

          <Card>
            <CardHeader title="Important dates" icon={<CalendarDays className="h-4 w-4" />} />
            <dl className="divide-y divide-line text-xs">
              <div className="flex justify-between gap-3 px-5 py-3">
                <dt className="text-muted">Application deadline</dt>
                <dd className="font-semibold text-ink">
                  {formatDate(opportunity.deadline, "EEEE, dd MMM yyyy")}
                </dd>
              </div>
              {opportunity.event_start ? (
                <div className="flex justify-between gap-3 px-5 py-3">
                  <dt className="text-muted">Event starts</dt>
                  <dd className="font-medium text-ink">{formatDate(opportunity.event_start)}</dd>
                </div>
              ) : null}
              {opportunity.event_end ? (
                <div className="flex justify-between gap-3 px-5 py-3">
                  <dt className="text-muted">Event ends</dt>
                  <dd className="font-medium text-ink">{formatDate(opportunity.event_end)}</dd>
                </div>
              ) : null}
              {opportunity.mode ? (
                <div className="flex justify-between gap-3 px-5 py-3">
                  <dt className="text-muted">Mode</dt>
                  <dd className="font-medium capitalize text-ink">{opportunity.mode}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            UniSync validates that application links use http(s) and shows the destination before you leave the
            platform. External sites are not controlled by the college.
          </p>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-navy-950 p-5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Application window</p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{formatDate(opportunity.deadline, "dd MMM yyyy")}</p>
                <Badge tone={deadline.tone}>{deadline.label}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-300">
                <CalendarClock className="h-3.5 w-3.5" />
                {closed ? "Application window has closed" : "Applications are open"}
              </div>
              {opportunity.location ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-300">
                  <MapPin className="h-3.5 w-3.5" /> {opportunity.location}
                </p>
              ) : null}
              <div className="mt-4">
                {url && !closed ? (
                  <ExternalLinkButton url={url} />
                ) : (
                  <p className="rounded-lg bg-white/10 px-3 py-2 text-[10px] text-slate-300">
                    {closed ? "This opportunity is closed." : "This opportunity has no valid application link."}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 p-4">
              <Avatar name={opportunity.poster?.full_name ?? "Campus office"} size="sm" />
              <div>
                <p className="text-[11px] font-semibold text-ink">{opportunity.poster?.full_name ?? "Campus office"}</p>
                <p className="text-[9px] text-muted">Published on UniSync</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold text-ink">Application checklist</p>
            <ul className="mt-2 space-y-1.5 text-[10px] text-muted">
              {[
                "Read the eligibility criteria carefully.",
                "Keep your resume and portfolio links ready.",
                "Apply before the deadline; late entries are not accepted.",
                "Verify the destination site before sharing personal data.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          {profile.role === "admin" ? (
            <Card className="p-4">
              <form action={deleteOpportunityAction}>
                <input type="hidden" name="id" value={opportunity.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-red-600 hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Remove this opportunity
                </button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
