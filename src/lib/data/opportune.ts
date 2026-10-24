import "server-only";
import type { Opportunity, Profile } from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyByRoles, writeAuditLog } from "@/lib/data/helpers";

export type OpportunityFilters = {
  q?: string;
  category?: string;
  deadline?: string;
  saved?: boolean;
};

export type OpportunityInput = {
  title: string;
  organization: string;
  category: Opportunity["category"];
  description: string;
  eligibility: string | null;
  location: string | null;
  mode: "online" | "offline" | "hybrid" | null;
  deadline: string;
  event_start: string | null;
  event_end: string | null;
  apply_url: string;
  tags: string[];
};

function deadlineLimit(window: string | undefined) {
  if (window === "week") return new Date(Date.now() + 7 * 86400000);
  if (window === "month") return new Date(Date.now() + 30 * 86400000);
  return null;
}

export async function listOpportunities(
  profile: Profile,
  filters: OpportunityFilters = {},
): Promise<Opportunity[]> {
  const { q, category, deadline, saved } = filters;

  if (isDemoMode()) {
    const store = getDemoStore();
    const bookmarked = new Set(
      store.opportunity_bookmarks
        .filter((bookmark) => bookmark.user_id === profile.id)
        .map((bookmark) => bookmark.opportunity_id),
    );
    const limit = deadlineLimit(deadline);
    const now = Date.now();
    return store.opportunities
      .filter((opportunity) => new Date(opportunity.deadline).getTime() >= now)
      .filter((opportunity) => {
        if (q) {
          const needle = q.toLowerCase();
          if (
            !opportunity.title.toLowerCase().includes(needle) &&
            !opportunity.organization.toLowerCase().includes(needle) &&
            !opportunity.tags.some((tag) => tag.toLowerCase().includes(needle))
          ) {
            return false;
          }
        }
        if (category && category !== "all" && opportunity.category !== category) return false;
        if (limit && new Date(opportunity.deadline) > limit) return false;
        if (saved && !bookmarked.has(opportunity.id)) return false;
        return true;
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .map((opportunity) => ({
        ...opportunity,
        poster: store.profiles.find((person) => person.id === opportunity.posted_by) ?? null,
        is_bookmarked: bookmarked.has(opportunity.id),
      }));
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("opportunities")
    .select("*, poster:profiles!opportunities_posted_by_fkey(id, full_name)")
    .gte("deadline", new Date().toISOString())
    .order("deadline", { ascending: true })
    .limit(100);

  if (q) {
    const safe = q.replace(/[%,()]/g, " ").trim();
    query = query.or(`title.ilike.%${safe}%,organization.ilike.%${safe}%`);
  }
  if (category && category !== "all") query = query.eq("category", category);
  const limit = deadlineLimit(deadline);
  if (limit) query = query.lte("deadline", limit.toISOString());

  const { data } = await query;
  let opportunities = (data ?? []) as Opportunity[];

  const { data: bookmarks } = await supabase
    .from("opportunity_bookmarks")
    .select("opportunity_id")
    .eq("user_id", profile.id);
  const bookmarked = new Set((bookmarks ?? []).map((row) => row.opportunity_id as string));
  opportunities = opportunities.map((opportunity) => ({
    ...opportunity,
    is_bookmarked: bookmarked.has(opportunity.id),
  }));
  if (saved) opportunities = opportunities.filter((opportunity) => opportunity.is_bookmarked);
  return opportunities;
}

export async function getOpportunity(profile: Profile, id: string): Promise<Opportunity | null> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const opportunity = store.opportunities.find((item) => item.id === id);
    if (!opportunity) return null;
    return {
      ...opportunity,
      poster: store.profiles.find((person) => person.id === opportunity.posted_by) ?? null,
      is_bookmarked: store.opportunity_bookmarks.some(
        (bookmark) => bookmark.user_id === profile.id && bookmark.opportunity_id === id,
      ),
    };
  }
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: bookmark }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*, poster:profiles!opportunities_posted_by_fkey(id, full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("opportunity_bookmarks")
      .select("opportunity_id")
      .eq("user_id", profile.id)
      .eq("opportunity_id", id)
      .maybeSingle(),
  ]);
  return data ? ({ ...(data as Opportunity), is_bookmarked: Boolean(bookmark) } as Opportunity) : null;
}

export async function toggleBookmark(profile: Profile, opportunityId: string) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const index = store.opportunity_bookmarks.findIndex(
      (bookmark) => bookmark.user_id === profile.id && bookmark.opportunity_id === opportunityId,
    );
    if (index >= 0) {
      store.opportunity_bookmarks.splice(index, 1);
      return { ok: true as const, bookmarked: false };
    }
    store.opportunity_bookmarks.push({
      user_id: profile.id,
      opportunity_id: opportunityId,
      created_at: new Date().toISOString(),
    });
    return { ok: true as const, bookmarked: true };
  }
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("opportunity_bookmarks")
    .select("opportunity_id")
    .eq("user_id", profile.id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("opportunity_bookmarks")
      .delete()
      .eq("user_id", profile.id)
      .eq("opportunity_id", opportunityId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, bookmarked: false };
  }
  const { error } = await supabase
    .from("opportunity_bookmarks")
    .insert({ user_id: profile.id, opportunity_id: opportunityId });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, bookmarked: true };
}

export async function createOpportunity(profile: Profile, input: OpportunityInput) {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { ok: false as const, error: "Only faculty and administrators can publish opportunities." };
  }
  if (new Date(input.deadline) < new Date()) {
    return { ok: false as const, error: "The application deadline must be in the future." };
  }

  let id = crypto.randomUUID();
  if (isDemoMode()) {
    const store = getDemoStore();
    store.opportunities.unshift({
      id,
      ...input,
      posted_by: profile.id,
      poster: { id: profile.id, full_name: profile.full_name },
      created_at: new Date().toISOString(),
    });
  } else {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("opportunities")
      .insert({ ...input, posted_by: profile.id })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    id = data.id as string;
  }

  await notifyByRoles(["student"], {
    title: `New ${input.category.replace("_", " ")}: ${input.title}`,
    body: `${input.organization} · apply by ${new Date(input.deadline).toLocaleDateString("en-IN")}`,
    type: "opportunity",
    link: `/opportune/${id}`,
  }, profile.id);
  await writeAuditLog(profile, "opportunity.published", "opportunities", id, { title: input.title });
  return { ok: true as const, id };
}

export async function deleteOpportunity(profile: Profile, id: string) {
  if (profile.role !== "admin") {
    return { ok: false as const, error: "Only administrators can remove opportunities." };
  }
  if (isDemoMode()) {
    getDemoStore().opportunities = getDemoStore().opportunities.filter(
      (opportunity) => opportunity.id !== id,
    );
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
  }
  await writeAuditLog(profile, "opportunity.deleted", "opportunities", id);
  return { ok: true as const };
}

export async function getRecommendedOpportunities(profile: Profile, limit = 3) {
  const all = await listOpportunities(profile);
  const interests = new Set(profile.interests ?? []);
  const matched = all.filter((opportunity) => interests.has(opportunity.category));
  const pool = matched.length ? matched : all;
  return pool.slice(0, limit);
}

export async function getUpcomingDeadlines(profile: Profile, limit = 4) {
  const all = await listOpportunities(profile, { deadline: "month" });
  return all.slice(0, limit);
}

export async function getSavedOpportunities(profile: Profile, limit = 4) {
  return (await listOpportunities(profile, { saved: true })).slice(0, limit);
}

export async function getOpportunityCategoryCounts(profile: Profile) {
  const all = await listOpportunities(profile);
  return all.reduce<Record<string, number>>((counts, opportunity) => {
    counts[opportunity.category] = (counts[opportunity.category] ?? 0) + 1;
    return counts;
  }, {});
}
