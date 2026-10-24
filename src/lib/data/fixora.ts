import "server-only";
import type {
  MaintenanceComment,
  MaintenanceHistory,
  MaintenanceRequest,
  MaintenanceStatus,
  Profile,
} from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyByRoles, notifyUsers, writeAuditLog } from "@/lib/data/helpers";

const OPEN_STATUSES: MaintenanceStatus[] = ["submitted", "under_review", "assigned", "in_progress"];
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validatePhoto(file: File | null) {
  if (!file || file.size === 0) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Upload a PNG, JPG or WebP image.";
  if (file.size > 5 * 1024 * 1024) return "Photos must be 5 MB or smaller.";
  return null;
}

export type MaintenanceFilters = {
  status?: string;
  category?: string;
  overdue?: boolean;
  q?: string;
};

function demoEnrich(request: MaintenanceRequest): MaintenanceRequest {
  const store = getDemoStore();
  return {
    ...request,
    student: store.profiles.find((person) => person.id === request.student_id) ?? null,
    assignee: request.assigned_to
      ? store.profiles.find((person) => person.id === request.assigned_to) ?? null
      : null,
  };
}

export function isOverdue(request: Pick<MaintenanceRequest, "status" | "created_at" | "priority">) {
  if (!OPEN_STATUSES.includes(request.status)) return false;
  const age = Date.now() - new Date(request.created_at).getTime();
  return age > 72 * 3600 * 1000 || (request.priority === "urgent" && age > 24 * 3600 * 1000);
}

export async function listMaintenanceRequests(
  profile: Profile,
  filters: MaintenanceFilters = {},
): Promise<MaintenanceRequest[]> {
  const { status, category, overdue, q } = filters;

  if (isDemoMode()) {
    return getDemoStore()
      .maintenance_requests.filter((request) => {
        if (profile.role === "student") return request.student_id === profile.id;
        if (profile.role === "faculty") {
          return request.assigned_to === profile.id || request.status === "submitted";
        }
        return true;
      })
      .filter((request) => (status && status !== "all" ? request.status === status : true))
      .filter((request) => (category && category !== "all" ? request.category === category : true))
      .filter((request) => (overdue ? isOverdue(request) : true))
      .filter((request) => {
        if (!q) return true;
        const needle = q.toLowerCase();
        return (
          request.title.toLowerCase().includes(needle) ||
          request.ticket_number.toLowerCase().includes(needle) ||
          request.building.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(demoEnrich);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("maintenance_requests")
    .select(
      "*, student:profiles!maintenance_requests_student_id_fkey(id, full_name, email), assignee:profiles!maintenance_requests_assigned_to_fkey(id, full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (profile.role === "student") query = query.eq("student_id", profile.id);
  if (profile.role === "faculty") {
    query = query.or(`assigned_to.eq.${profile.id},status.eq.submitted`);
  }
  if (status && status !== "all") query = query.eq("status", status);
  if (category && category !== "all") query = query.eq("category", category);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ").trim();
    query = query.or(`title.ilike.%${safe}%,ticket_number.ilike.%${safe}%,building.ilike.%${safe}%`);
  }
  const { data } = await query;
  let requests = (data ?? []) as MaintenanceRequest[];
  if (overdue) requests = requests.filter(isOverdue);
  return requests;
}

export async function getMaintenanceRequest(profile: Profile, id: string) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const request = store.maintenance_requests.find((item) => item.id === id);
    if (!request) return null;
    const allowed =
      profile.role === "admin" ||
      (profile.role === "student" && request.student_id === profile.id) ||
      (profile.role === "faculty" && (request.assigned_to === profile.id || request.status === "submitted"));
    if (!allowed) return null;
    const history: MaintenanceHistory[] = store.maintenance_history
      .filter((entry) => entry.request_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((entry) => ({
        ...entry,
        actor: store.profiles.find((person) => person.id === entry.changed_by) ?? null,
      }));
    const comments: MaintenanceComment[] = store.maintenance_comments
      .filter((comment) => comment.request_id === id)
      .filter((comment) => profile.role !== "student" || !comment.is_internal)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((comment) => ({
        ...comment,
        author: store.profiles.find((person) => person.id === comment.author_id) ?? null,
      }));
    return { request: demoEnrich(request), history, comments };
  }

  const supabase = await createSupabaseServerClient();
  const { data: request } = await supabase
    .from("maintenance_requests")
    .select(
      "*, student:profiles!maintenance_requests_student_id_fkey(id, full_name, email), assignee:profiles!maintenance_requests_assigned_to_fkey(id, full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!request) return null;

  const [{ data: history }, { data: comments }] = await Promise.all([
    supabase
      .from("maintenance_request_history")
      .select("*, actor:profiles!maintenance_request_history_changed_by_fkey(id, full_name)")
      .eq("request_id", id)
      .order("created_at"),
    supabase
      .from("maintenance_comments")
      .select("*, author:profiles!maintenance_comments_author_id_fkey(id, full_name, role)")
      .eq("request_id", id)
      .order("created_at"),
  ]);

  return {
    request: request as MaintenanceRequest,
    history: (history ?? []) as MaintenanceHistory[],
    comments: ((comments ?? []) as MaintenanceComment[]).filter(
      (comment) => profile.role !== "student" || !comment.is_internal,
    ),
  };
}

export async function createMaintenanceRequest(
  profile: Profile,
  input: { title: string; description: string; category: string; building: string; room: string },
  photo: File | null,
) {
  if (profile.role !== "student") {
    return { ok: false as const, error: "Only students can submit maintenance complaints." };
  }
  const photoError = validatePhoto(photo);
  if (photoError) return { ok: false as const, error: photoError };

  let id = crypto.randomUUID();
  let ticket = "";

  if (isDemoMode()) {
    const store = getDemoStore();
    ticket = `FX-${2088 + store.maintenance_requests.length}`;
    const request: MaintenanceRequest = {
      id,
      ticket_number: ticket,
      student_id: profile.id,
      student: { id: profile.id, full_name: profile.full_name, email: profile.email },
      ...input,
      photo_path: photo && photo.size > 0 ? `demo://${photo.name}` : null,
      priority: "medium",
      status: "submitted",
      assigned_to: null,
      resolution_note: null,
      resolution_photo_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null,
    };
    store.maintenance_requests.unshift(request);
    store.maintenance_history.push({
      id: crypto.randomUUID(),
      request_id: id,
      status: "submitted",
      note: "Complaint submitted by student.",
      changed_by: profile.id,
      actor: { id: profile.id, full_name: profile.full_name },
      created_at: new Date().toISOString(),
    });
  } else {
    const supabase = await createSupabaseServerClient();
    let photoPath: string | null = null;
    if (photo && photo.size > 0) {
      photoPath = `${profile.id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("maintenance-photos")
        .upload(photoPath, photo, { contentType: photo.type, upsert: false });
      if (uploadError) return { ok: false as const, error: `Photo upload failed: ${uploadError.message}` };
    }
    const { data, error } = await supabase
      .from("maintenance_requests")
      .insert({
        student_id: profile.id,
        ...input,
        photo_path: photoPath,
        status: "submitted",
        priority: "medium",
      })
      .select("id, ticket_number")
      .single();
    if (error) return { ok: false as const, error: error.message };
    id = data.id as string;
    ticket = data.ticket_number as string;
    await supabase.from("maintenance_request_history").insert({
      request_id: id,
      status: "submitted",
      note: "Complaint submitted by student.",
      changed_by: profile.id,
    });
  }

  await notifyByRoles(["admin"], {
    title: `New complaint ${ticket}`,
    body: `${profile.full_name} reported: ${input.title}`,
    type: "maintenance",
    link: `/fixora/${id}`,
  });
  await notifyUsers([profile.id], {
    title: `Complaint ${ticket} submitted`,
    body: "Facilities will review your report. Track updates in Fixora.",
    type: "maintenance",
    link: `/fixora/${id}`,
  });
  await writeAuditLog(profile, "maintenance.created", "maintenance_requests", id, { ticket });
  return { ok: true as const, id, ticket };
}

export async function updateMaintenanceRequest(
  profile: Profile,
  id: string,
  input: {
    status: MaintenanceStatus;
    priority: MaintenanceRequest["priority"];
    assigned_to: string | null;
    note: string | null;
  },
  resolutionPhoto: File | null,
) {
  if (profile.role !== "admin") {
    return { ok: false as const, error: "Only administrators can update complaint workflow." };
  }
  const photoError = validatePhoto(resolutionPhoto);
  if (photoError) return { ok: false as const, error: photoError };

  const existing = await getMaintenanceRequest(profile, id);
  if (!existing) return { ok: false as const, error: "Complaint not found." };

  let resolutionPhotoPath = existing.request.resolution_photo_path;
  if (!isDemoMode() && resolutionPhoto && resolutionPhoto.size > 0) {
    const supabase = await createSupabaseServerClient();
    const path = `resolution/${id}/${crypto.randomUUID()}-${resolutionPhoto.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage
      .from("maintenance-photos")
      .upload(path, resolutionPhoto, { contentType: resolutionPhoto.type, upsert: false });
    if (error) return { ok: false as const, error: `Evidence upload failed: ${error.message}` };
    resolutionPhotoPath = path;
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    const target = store.maintenance_requests.find((request) => request.id === id);
    if (!target) return { ok: false as const, error: "Complaint not found." };
    const statusChanged = target.status !== input.status;
    target.status = input.status;
    target.priority = input.priority;
    target.assigned_to = input.assigned_to;
    target.updated_at = new Date().toISOString();
    if (input.status === "resolved") {
      target.resolved_at = new Date().toISOString();
      target.resolution_note = input.note;
      if (resolutionPhoto) target.resolution_photo_path = `demo://${resolutionPhoto.name}`;
    }
    if (statusChanged || input.note) {
      store.maintenance_history.push({
        id: crypto.randomUUID(),
        request_id: id,
        status: input.status,
        note: input.note ?? `Status changed to ${input.status.replace("_", " ")}.`,
        changed_by: profile.id,
        actor: { id: profile.id, full_name: profile.full_name },
        created_at: new Date().toISOString(),
      });
    }
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("maintenance_requests")
      .update({
        status: input.status,
        priority: input.priority,
        assigned_to: input.assigned_to,
        resolution_note: input.status === "resolved" ? input.note : existing.request.resolution_note,
        resolution_photo_path: resolutionPhotoPath,
        resolved_at: input.status === "resolved" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    await supabase.from("maintenance_request_history").insert({
      request_id: id,
      status: input.status,
      note: input.note ?? `Status changed to ${input.status.replace("_", " ")}.`,
      changed_by: profile.id,
    });
  }

  await notifyUsers([existing.request.student_id], {
    title: `Complaint ${existing.request.ticket_number} updated`,
    body: `Status: ${input.status.replace("_", " ")}${input.note ? ` — ${input.note}` : ""}`,
    type: "maintenance",
    link: `/fixora/${id}`,
  });
  if (input.assigned_to && input.assigned_to !== existing.request.assigned_to) {
    await notifyUsers([input.assigned_to], {
      title: `Complaint ${existing.request.ticket_number} assigned to you`,
      body: existing.request.title,
      type: "maintenance",
      link: `/fixora/${id}`,
    });
  }
  await writeAuditLog(profile, "maintenance.updated", "maintenance_requests", id, {
    status: input.status,
    priority: input.priority,
    assigned_to: input.assigned_to,
  });
  return { ok: true as const };
}

export async function addMaintenanceComment(
  profile: Profile,
  requestId: string,
  body: string,
  isInternal = false,
) {
  const detail = await getMaintenanceRequest(profile, requestId);
  if (!detail) return { ok: false as const, error: "Complaint not found or access denied." };
  if (isInternal && profile.role === "student") {
    return { ok: false as const, error: "Students cannot post internal notes." };
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    store.maintenance_comments.push({
      id: crypto.randomUUID(),
      request_id: requestId,
      author_id: profile.id,
      body,
      is_internal: isInternal,
      created_at: new Date().toISOString(),
      author: { id: profile.id, full_name: profile.full_name, role: profile.role },
    });
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("maintenance_comments").insert({
      request_id: requestId,
      author_id: profile.id,
      body,
      is_internal: isInternal,
    });
    if (error) return { ok: false as const, error: error.message };
  }

  if (!isInternal) {
    const recipients =
      profile.role === "student"
        ? [detail.request.assigned_to].filter(Boolean)
        : [detail.request.student_id];
    await notifyUsers(recipients as string[], {
      title: `New comment on ${detail.request.ticket_number}`,
      body: `${profile.full_name}: ${body.slice(0, 120)}`,
      type: "maintenance",
      link: `/fixora/${requestId}`,
    });
  }
  return { ok: true as const };
}

export async function getMaintenancePhotoUrl(path: string | null) {
  if (!path || isDemoMode()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.storage.from("maintenance-photos").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function getMaintenanceStats() {
  const all = isDemoMode()
    ? getDemoStore().maintenance_requests
    : ((
        await (
          await createSupabaseServerClient()
        )
          .from("maintenance_requests")
          .select("status, category, priority, created_at, updated_at, resolved_at")
          .limit(500)
      ).data ?? []);

  const byStatus = all.reduce<Record<string, number>>((counts, request) => {
    counts[request.status] = (counts[request.status] ?? 0) + 1;
    return counts;
  }, {});
  const byCategory = all.reduce<Record<string, number>>((counts, request) => {
    counts[request.category] = (counts[request.category] ?? 0) + 1;
    return counts;
  }, {});
  const overdue = all.filter((request) =>
    isOverdue(request as Pick<MaintenanceRequest, "status" | "created_at" | "priority">),
  ).length;
  const resolved = all.filter((request) => request.status === "resolved");
  const averageResolutionHours = resolved.length
    ? Math.round(
        resolved.reduce((total, request) => {
          const end = request.resolved_at ?? request.updated_at;
          return total + (new Date(end).getTime() - new Date(request.created_at).getTime()) / 3600000;
        }, 0) / resolved.length,
      )
    : 0;

  return { total: all.length, byStatus, byCategory, overdue, averageResolutionHours };
}

export async function listAssigneeCandidates() {
  if (isDemoMode()) {
    return getDemoStore()
      .profiles.filter((profile) => profile.role === "faculty" || profile.role === "admin")
      .map((profile) => ({ id: profile.id, full_name: profile.full_name }));
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["faculty", "admin"])
    .order("full_name");
  return (data ?? []) as { id: string; full_name: string }[];
}
