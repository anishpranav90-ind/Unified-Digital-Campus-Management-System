"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-state";
import { requireProfile } from "@/lib/session";
import { groupSchema, messageSchema } from "@/lib/validations";
import {
  addGroupMember,
  createMentorGroup,
  markGroupRead,
  removeGroupMember,
  sendGroupMessage,
} from "@/lib/data/mentorloop";

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
