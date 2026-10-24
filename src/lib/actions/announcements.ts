"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/action-state";
import { requireProfile } from "@/lib/session";
import { announcementSchema } from "@/lib/validations";
import { createAnnouncement, markAnnouncementRead } from "@/lib/data/announcements";

export async function publishAnnouncementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    category: formData.get("category"),
    audience: formData.get("audience"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the announcement details." };

  const result = await createAnnouncement(profile, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { success: "Announcement published and notifications sent." };
}

export async function markAnnouncementReadAction(id: string) {
  const profile = await requireProfile();
  await markAnnouncementRead(profile, id);
  revalidatePath("/announcements");
}
