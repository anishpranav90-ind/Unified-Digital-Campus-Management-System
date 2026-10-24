import "server-only";
import type { Announcement, Profile } from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { audienceRoles, notifyByRoles, visibleAudiences, writeAuditLog } from "@/lib/data/helpers";

export async function listAnnouncements(profile: Profile, limit = 20): Promise<Announcement[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const audiences = visibleAudiences(profile.role);
    return store.announcements
      .filter((announcement) => audiences.includes(announcement.audience))
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .slice(0, limit)
      .map((announcement) => ({
        ...announcement,
        author: store.profiles.find((item) => item.id === announcement.author_id) ?? null,
        is_read: store.announcement_reads.some(
          (read) => read.announcement_id === announcement.id && read.user_id === profile.id,
        ),
      }));
  }

  const supabase = await createSupabaseServerClient();
  const audiences = visibleAudiences(profile.role);
  const { data } = await supabase
    .from("announcements")
    .select("*, author:profiles(id, full_name, role)")
    .in("audience", audiences)
    .order("published_at", { ascending: false })
    .limit(limit);

  const announcements = (data ?? []) as Announcement[];
  if (!announcements.length) return [];

  const { data: reads } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", profile.id)
    .in(
      "announcement_id",
      announcements.map((announcement) => announcement.id),
    );
  const readIds = new Set((reads ?? []).map((row) => row.announcement_id as string));
  return announcements.map((announcement) => ({ ...announcement, is_read: readIds.has(announcement.id) }));
}

export async function createAnnouncement(
  profile: Profile,
  input: { title: string; body: string; category: Announcement["category"]; audience: Announcement["audience"] },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { ok: false, error: "Only faculty and administrators can publish announcements." };
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    const announcement: Announcement = {
      id: crypto.randomUUID(),
      ...input,
      author_id: profile.id,
      author: { id: profile.id, full_name: profile.full_name, role: profile.role },
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      attachment_path: null,
      attachment_name: null,
      is_read: false,
    };
    store.announcements.unshift(announcement);
    store.announcement_reads.push({
      announcement_id: announcement.id,
      user_id: profile.id,
      created_at: new Date().toISOString(),
    });
    await notifyByRoles(
      audienceRoles(input.audience),
      {
        title: input.title,
        body: input.body.slice(0, 160),
        type: "announcement",
        link: "/announcements",
      },
      profile.id,
    );
    await writeAuditLog(profile, "announcement.published", "announcements", announcement.id, {
      title: input.title,
      audience: input.audience,
    });
    return { ok: true, id: announcement.id };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      ...input,
      author_id: profile.id,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await notifyByRoles(audienceRoles(input.audience), {
    title: input.title,
    body: input.body.slice(0, 160),
    type: "announcement",
    link: "/announcements",
  }, profile.id);
  await writeAuditLog(profile, "announcement.published", "announcements", data.id, {
    title: input.title,
    audience: input.audience,
  });
  return { ok: true, id: data.id as string };
}

export async function markAnnouncementRead(profile: Profile, announcementId: string) {
  if (isDemoMode()) {
    const store = getDemoStore();
    if (
      !store.announcement_reads.some(
        (read) => read.announcement_id === announcementId && read.user_id === profile.id,
      )
    ) {
      store.announcement_reads.push({
        announcement_id: announcementId,
        user_id: profile.id,
        created_at: new Date().toISOString(),
      });
    }
    return;
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("announcement_reads")
    .upsert({ announcement_id: announcementId, user_id: profile.id }, { onConflict: "announcement_id,user_id" });
}
