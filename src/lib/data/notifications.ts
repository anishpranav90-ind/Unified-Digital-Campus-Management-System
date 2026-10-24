import "server-only";
import type { AppNotification, Profile } from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listNotifications(profile: Profile, limit = 30): Promise<AppNotification[]> {
  if (isDemoMode()) {
    return getDemoStore()
      .notifications.filter((notification) => notification.user_id === profile.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadNotificationCount(profile: Profile): Promise<number> {
  if (isDemoMode()) {
    return getDemoStore().notifications.filter(
      (notification) => notification.user_id === profile.id && !notification.is_read,
    ).length;
  }
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);
  return count ?? 0;
}

export async function markNotificationRead(profile: Profile, notificationId: string) {
  if (isDemoMode()) {
    const notification = getDemoStore().notifications.find(
      (item) => item.id === notificationId && item.user_id === profile.id,
    );
    if (notification) notification.is_read = true;
    return;
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", profile.id);
}

export async function markAllNotificationsRead(profile: Profile) {
  if (isDemoMode()) {
    getDemoStore()
      .notifications.filter((item) => item.user_id === profile.id)
      .forEach((item) => {
        item.is_read = true;
      });
    return;
  }
  const supabase = await createSupabaseServerClient();
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
}
