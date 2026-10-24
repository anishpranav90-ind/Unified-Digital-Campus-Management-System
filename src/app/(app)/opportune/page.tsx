import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  MapPin,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { requireProfile } from "@/lib/session";
import { listOpportunities, getRecommendedOpportunities } from "@/lib/data/opportune";
import { toggleBookmarkAction } from "@/lib/actions/opportune";
import { formatDate, safeExternalUrl } from "@/lib/utils";
import { OPPORTUNITY_CATEGORIES } from "@/lib/constants";
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
} from "@/components/ui";
import { OpportunityCategoryBadge } from "@/components/modules/status-badge";
import { OpportunityForm } from "./opportunity-form";

export const metadata = { title: "Opportune" };

function daysLeft(deadline: string) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default async function OpportunePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; deadline?: string; saved?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const filters = {
    q: params.q ?? "",
    category: params.category ?? "all",
    deadline: params.deadline ?? "all",
    saved: params.saved === "1",
  };

  const [opportunities, recommended] = await Promise.all([
    listOpportunities(profile, filters),
    profile.role === "student" ? getRecommendedOpportunities(profile, 2) : Promise.resolve([]),
  ]);
  const canPublish = profile.role === "faculty" || profile.role === "admin";
  const savedCount = opportunities.filter((item) => item.is_bookmarked).length;

  return (
    <div>
      <PageHeader
        eyebrow="Opportune · Events & opportunities"
        title="Opportunity board"
        description="Hackathons, internships, workshops and scholarships — curated for campus, with deadlines you can actually track."
        actions={
          canPublish ? (
            <ButtonLink href="#publish" size="sm" variant="accent">
              Publish opportunity
            </ButtonLink>
          ) : (
            <Badge tone="violet">
              <Sparkles className="h-3 w-3" /> Recommended for you
            </Badge>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live opportunities" value={opportunities.length} icon={<Trophy className="h-5 w-5" />} tone="violet" />
        <StatCard
          label="Closing this week"
          value={opportunities.filter((item) => daysLeft(item.deadline) <= 7).length}
          hint="Applications due soon"
          icon={<CalendarClock className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard label="Saved by you" value={savedCount} icon={<Bookmark className="h-5 w-5" />} tone="blue" />
        <StatCard label="Categories" value={OPPORTUNITY_CATEGORIES.length} icon={<Users className="h-5 w-5" />} tone="teal" />
      </div>

      {profile.role === "student" && recommended.length ? (
        <Card className="mt-5 overflow-hidden">
          <div className="bg-navy-950 px-5 py-4 text-white">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-orange">
              <Sparkles className="h-3.5 w-3.5" /> Matched to your interests
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recommended.map((item) => (
                <Link
                  key={item.id}
                  href={`/opportune/${item.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors hover:bg-white/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{item.title}</span>
                    <span className="block truncate text-[10px] text-slate-400">{item.organization}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <form method="GET" className="mt-5 rounded-2xl border border-line bg-white p-3 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={filters.q}
              placeholder="Search by title, organization or tag…"
              className="pl-9"
              aria-label="Search opportunities"
            />
          </div>
          <Select name="category" defaultValue={filters.category} aria-label="Filter category" className="sm:w-44">
            <option value="all">All categories</option>
            {OPPORTUNITY_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </Select>
          <Select name="deadline" defaultValue={filters.deadline} aria-label="Filter deadline" className="sm:w-44">
            <option value="all">Any deadline</option>
            <option value="week">Next 7 days</option>
            <option value="month">Next 30 days</option>
          </Select>
          <label className="flex items-center gap-2 rounded-xl border border-line px-3 text-xs text-slate-600">
            <input
              type="checkbox"
              name="saved"
              value="1"
              defaultChecked={filters.saved}
              className="h-3.5 w-3.5 accent-blue-600"
            />
            Saved only
          </label>
          <Button type="submit" variant="primary">
            Filter
          </Button>
          {(filters.q || filters.category !== "all" || filters.deadline !== "all" || filters.saved) ? (
            <Link
              href="/opportune"
              className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Reset
            </Link>
          ) : null}
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Link
          href="/opportune"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            filters.category === "all" ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-slate-600"
          }`}
        >
          All
        </Link>
        {OPPORTUNITY_CATEGORIES.map((category) => (
          <Link
            key={category.value}
            href={`/opportune?category=${category.value}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              filters.category === category.value
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-line bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {category.label}
          </Link>
        ))}
      </div>

      <div className={`mt-5 grid gap-4 ${canPublish ? "lg:grid-cols-3" : ""}`}>
        <div className={canPublish ? "lg:col-span-2" : ""}>
          {opportunities.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Trophy className="h-5 w-5" />}
                title="No opportunities match your filters"
                description="Try clearing the search, changing category, or checking saved opportunities."
                action={
                  <ButtonLink href="/opportune" size="sm" variant="secondary">
                    Reset filters
                  </ButtonLink>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {opportunities.map((opportunity) => {
                const url = safeExternalUrl(opportunity.apply_url);
                return (
                  <Card key={opportunity.id} className="flex flex-col p-4 transition-shadow hover:shadow-lift">
                    <div className="flex items-start justify-between gap-2">
                      <OpportunityCategoryBadge category={opportunity.category} />
                      <form action={toggleBookmarkAction}>
                        <input type="hidden" name="opportunity_id" value={opportunity.id} />
                        <button
                          type="submit"
                          aria-label={opportunity.is_bookmarked ? "Remove bookmark" : "Save opportunity"}
                          className={`rounded-lg border p-1.5 transition-colors ${
                            opportunity.is_bookmarked
                              ? "border-amber-200 bg-amber-50 text-amber-600"
                              : "border-line text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          {opportunity.is_bookmarked ? (
                            <BookmarkCheck className="h-3.5 w-3.5" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </form>
                    </div>
                    <Link href={`/opportune/${opportunity.id}`} className="mt-2.5 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold text-ink">{opportunity.title}</h3>
                      <p className="mt-0.5 truncate text-[11px] text-muted">{opportunity.organization}</p>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                        {opportunity.description}
                      </p>
                    </Link>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> Closes {formatDate(opportunity.deadline, "dd MMM")}
                      </span>
                      {opportunity.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {opportunity.location}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                      <Badge tone={daysLeft(opportunity.deadline) <= 7 ? "red" : "slate"}>
                        {daysLeft(opportunity.deadline)} days left
                      </Badge>
                      <Link
                        href={`/opportune/${opportunity.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue"
                      >
                        Details {url ? <ArrowRight className="h-3 w-3" /> : null}
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {canPublish ? (
          <Card className="h-fit scroll-mt-24" id="publish">
            <CardHeader
              title="Publish an opportunity"
              description="Visible to students immediately"
              icon={<Trophy className="h-4 w-4" />}
            />
            <OpportunityForm />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
