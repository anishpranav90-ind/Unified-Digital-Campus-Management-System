"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-state";
import { requireProfile } from "@/lib/session";
import {
  groupSchema,
  messageSchema,
  mentorActivityReviewSchema,
  mentorActivitySubmissionSchema,
} from "@/lib/validations";
import {
  addGroupMember,
  createMentorGroup,
  markGroupRead,
  importMentorGroupActivities,
  reviewMentorGroupActivity,
  removeGroupMember,
  sendGroupMessage,
  submitMentorGroupActivity,
} from "@/lib/data/mentorloop";
import { normalizeSafeProofUrl, parseMentorActivityCsv } from "@/lib/mentorloop/activity-csv";

export async function sendMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const groupId = String(formData.get("group_id") ?? "");
  let body = "";
  try {
    body = String(formData.get("body") ?? "").trim();
    const file = formData.get("attachment");
    const parsed = messageSchema.safeParse({ body });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Write a message." };
    const result = await sendGroupMessage(
      profile,
      groupId,
      parsed.data.body,
      file instanceof File && file.size > 0 ? file : null,
    );
    if (!result.ok) return { error: result.error };
  } catch (error) {
    console.error("sendMessageAction failed", error);
    return { error: "Message could not be sent. Try again." };
  }
  revalidatePath(`/mentorloop/${groupId}`);
  revalidatePath("/mentorloop");
  revalidatePath("/dashboard");
  return { success: `Sent at ${new Date().toISOString()}` };
}

export async function markGroupReadAction(groupId: string) {
  const profile = await requireProfile();
  await markGroupRead(profile, groupId);
  revalidatePath("/mentorloop");
}

export async function createGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    mentor_id: formData.get("mentor_id") || profile.id,
    department_id: formData.get("department_id") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the group details." };
  const studentIds = formData.getAll("student_ids").map(String).filter(Boolean);
  const result = await createMentorGroup(
    profile,
    {
      name: parsed.data.name,
      description: parsed.data.description,
      mentor_id: parsed.data.mentor_id,
      department_id: parsed.data.department_id || null,
    },
    studentIds,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/mentorloop");
  redirect(`/mentorloop/${result.id}`);
}

export async function addGroupMemberAction(formData: FormData) {
  const profile = await requireProfile();
  const groupId = String(formData.get("group_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const result = await addGroupMember(profile, groupId, userId);
  revalidatePath(`/mentorloop/${groupId}`);
  if (!result.ok) redirect(`/mentorloop/${groupId}?error=${encodeURIComponent(result.error)}`);
}

export async function removeGroupMemberAction(formData: FormData) {
  const profile = await requireProfile();
  const groupId = String(formData.get("group_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const result = await removeGroupMember(profile, groupId, userId);
  revalidatePath(`/mentorloop/${groupId}`);
  if (!result.ok) redirect(`/mentorloop/${groupId}?error=${encodeURIComponent(result.error)}`);
}

export async function importGroupActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const groupId = String(formData.get("group_id") ?? "");
  const file = formData.get("records");
  if (!/^[\da-f-]{36}$/i.test(groupId)) return { error: "Invalid mentor group." };
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { error: "Only the group mentor or an administrator can import activity records." };
  }
  if (!(file instanceof File) || file.size === 0 || !file.name.toLowerCase().endsWith(".csv")) {
    return { error: "Choose a CSV export file." };
  }
  if (file.size > 1_048_576) return { error: "CSV files must be 1 MB or smaller." };

  const parsed = parseMentorActivityCsv(await file.text());
  if (!parsed.ok) return { error: parsed.error };
  const result = await importMentorGroupActivities(profile, groupId, parsed.records);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/mentorloop/${groupId}`);
  return {
    success: `Imported ${result.inserted} verified record${result.inserted === 1 ? "" : "s"}${result.duplicates ? `; skipped ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"}` : ""}.`,
  };
}

export async function submitGroupActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (profile.role !== "student") return { error: "Only students can submit activity proofs." };
  const parsed = mentorActivitySubmissionSchema.safeParse({
    group_id: formData.get("group_id"),
    activity_id: formData.get("activity_id") ?? "",
    category: formData.get("category"),
    activity_type: formData.get("activity_type"),
    title: formData.get("title"),
    occurred_at: formData.get("occurred_at"),
    proof_url: formData.get("proof_url") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the activity details." };

  const proof_url = parsed.data.proof_url ? normalizeSafeProofUrl(parsed.data.proof_url) : null;
  if (parsed.data.proof_url && !proof_url) {
    return { error: "Proof links must use HTTPS and point to a public website (not a local or IP address)." };
  }
  const occurredAt = new Date(`${parsed.data.occurred_at}T12:00:00.000Z`);
  if (Number.isNaN(occurredAt.getTime())) return { error: "Choose a valid activity date." };

  const result = await submitMentorGroupActivity(profile, parsed.data.group_id, {
    activity_id: parsed.data.activity_id || undefined,
    category: parsed.data.category,
    activity_type: parsed.data.activity_type,
    title: parsed.data.title,
    occurred_at: occurredAt.toISOString(),
    proof_url,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/mentorloop/${parsed.data.group_id}`);
  return { success: parsed.data.activity_id ? "Pending proof updated." : "Proof submitted for mentor review." };
}

export async function reviewGroupActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { error: "Only mentors and administrators can review activity proofs." };
  }
  const parsed = mentorActivityReviewSchema.safeParse({
    group_id: formData.get("group_id"),
    activity_id: formData.get("activity_id"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid activity review." };
  const result = await reviewMentorGroupActivity(
    profile,
    parsed.data.group_id,
    parsed.data.activity_id,
    parsed.data.decision,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath(`/mentorloop/${parsed.data.group_id}`);
  return { success: parsed.data.decision === "verified" ? "Activity proof verified." : "Activity proof rejected." };
}
