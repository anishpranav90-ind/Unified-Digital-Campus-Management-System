import "server-only";
import type { AppNotification, Profile, Role } from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

export function audienceRoles(audience: string): Role[] {
  switch (audience) {
    case "students":
      return ["student"];
    case "faculty":
      return ["faculty", "admin"];
    case "admins":
      return ["admin"];
    default:
      return ["student", "faculty", "admin"];
  }
}

export function visibleAudiences(role: Role) {
  if (role === "admin") return ["all", "students", "faculty", "admins"];
  // Faculty can review student notices (including their own) without receiving
  // student-only notifications. Administrator-only notices stay private.
  if (role === "faculty") return ["all", "students", "faculty"];
  return ["all", "students"];
}

export async function notifyUsers(
  userIds: string[],
  notification: Pick<AppNotification, "title" | "body" | "type"> & { link?: string | null },
) {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (!unique.length) return;

  if (isDemoMode()) {
    const store = getDemoStore();
    const created = new Date().toISOString();
    unique.forEach((userId) => {
      store.notifications.unshift({
        id: crypto.randomUUID(),
        user_id: userId,
        title: notification.title,
        body: notification.body,
        link: notification.link ?? null,
        type: notification.type,
        is_read: false,
        created_at: created,
      });
    });
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("notify_users", {
    target_ids: unique,
    p_title: notification.title,
    p_body: notification.body,
    p_link: notification.link ?? null,
    p_type: notification.type,
  });
  if (error) console.error("notifications insert failed", error.message);
}

export async function notifyByRoles(
  roles: Role[],
  notification: Pick<AppNotification, "title" | "body" | "type"> & { link?: string | null },
  excludeUserId?: string,
) {
  if (!roles.length) return;
  if (isDemoMode()) {
    const ids = getDemoStore()
      .profiles.filter((profile) => roles.includes(profile.role) && profile.id !== excludeUserId)
      .map((profile) => profile.id);
    await notifyUsers(ids, notification);
    return;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("profiles").select("id").in("role", roles);
  if (excludeUserId) query = query.neq("id", excludeUserId);
  const { data } = await query;
  await notifyUsers((data ?? []).map((row) => row.id as string), notification);
}

export async function writeAuditLog(
  actor: Profile | null,
  action: string,
  entity: string,
  entityId: string | null,
  details?: Record<string, unknown>,
) {
  if (isDemoMode()) {
    getDemoStore().audit_logs.unshift({
      id: crypto.randomUUID(),
      actor_id: actor?.id ?? null,
      action,
      entity,
      entity_id: entityId,
      details: details ?? null,
      created_at: new Date().toISOString(),
    });
    return;
  }
  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_logs").insert({
    actor_id: actor?.id ?? null,
    action,
    entity,
    entity_id: entityId,
    details: details ?? null,
  });
}

export function demoStoreOrThrow() {
  return getDemoStore();
}

export function ticketNumber(prefix: string, count: number) {
  return `${prefix}-${String(1000 + count + 1).slice(-4)}`;
}
