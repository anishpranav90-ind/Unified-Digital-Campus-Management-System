"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/data/notifications";

export async function markNotificationReadAction(id: string) {
  const profile = await requireProfile();
  await markNotificationRead(profile, id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const profile = await requireProfile();
  await markAllNotificationsRead(profile);
  revalidatePath("/", "layout");
}
