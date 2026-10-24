"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/action-state";
import { requireProfile } from "@/lib/session";
import { opportunitySchema } from "@/lib/validations";
import { createOpportunity, deleteOpportunity, toggleBookmark } from "@/lib/data/opportune";
import { safeExternalUrl } from "@/lib/utils";

export async function publishOpportunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = opportunitySchema.safeParse({
    title: formData.get("title"),
    organization: formData.get("organization"),
    category: formData.get("category"),
    description: formData.get("description"),
    eligibility: formData.get("eligibility") ?? "",
    location: formData.get("location") ?? "",
    mode: formData.get("mode") || undefined,
    deadline: formData.get("deadline"),
    event_start: formData.get("event_start") ?? "",
    event_end: formData.get("event_end") ?? "",
    apply_url: formData.get("apply_url"),
    tags: formData.get("tags") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the opportunity details." };
  const url = safeExternalUrl(parsed.data.apply_url);
  if (!url) return { error: "Enter a valid http(s) application link." };

  const toIso = (value: string | undefined, endOfDay = false) => {
    if (!value) return null;
    const date = new Date(`${value}${endOfDay ? "T23:59:59" : "T00:00:00"}`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const result = await createOpportunity(profile, {
    title: parsed.data.title,
    organization: parsed.data.organization,
    category: parsed.data.category,
    description: parsed.data.description,
    eligibility: parsed.data.eligibility || null,
    location: parsed.data.location || null,
    mode: parsed.data.mode ?? null,
    deadline: toIso(parsed.data.deadline, true) ?? new Date().toISOString(),
    event_start: toIso(parsed.data.event_start),
    event_end: toIso(parsed.data.event_end),
    apply_url: url,
    tags: (parsed.data.tags ?? "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/opportune");
  revalidatePath("/dashboard");
  return { success: "Opportunity published and students notified." };
}

export async function toggleBookmarkAction(formData: FormData) {
  const profile = await requireProfile();
  const id = String(formData.get("opportunity_id") ?? "");
  const result = await toggleBookmark(profile, id);
  revalidatePath("/opportune");
  revalidatePath(`/opportune/${id}`);
  revalidatePath("/dashboard");
  if (!result.ok) {
    const { redirect } = await import("next/navigation");
    redirect(`/opportune/${id}?error=${encodeURIComponent(result.error)}`);
  }
}

export async function deleteOpportunityAction(formData: FormData) {
  const profile = await requireProfile();
  await deleteOpportunity(profile, String(formData.get("id") ?? ""));
  revalidatePath("/opportune");
}
