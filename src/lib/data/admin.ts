import "server-only";
import type { AuditLog, Profile, Role } from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/data/helpers";

export async function getAdminStats() {
  if (isDemoMode()) {
    const store = getDemoStore();
    const printStatus = store.print_requests.reduce<Record<string, number>>((counts, request) => {
      counts[request.status] = (counts[request.status] ?? 0) + 1;
      return counts;
    }, {});
    const maintenanceStatus = store.maintenance_requests.reduce<Record<string, number>>(
      (counts, request) => {
        counts[request.status] = (counts[request.status] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const now = Date.now();
    return {
      users: store.profiles.length,
      students: store.profiles.filter((profile) => profile.role === "student").length,
      faculty: store.profiles.filter((profile) => profile.role === "faculty").length,
      admins: store.profiles.filter((profile) => profile.role === "admin").length,
      activePrint: store.print_requests.filter((request) =>
        ["submitted", "queued", "processing"].includes(request.status),
      ).length,
      readyPrint: store.print_requests.filter((request) => request.status === "ready").length,
      totalPrint: store.print_requests.length,
      printRevenue: store.print_requests
        .filter((request) => request.status !== "cancelled")
        .reduce((total, request) => total + Number(request.estimated_cost), 0),
      printStatus,
      pendingMaintenance: store.maintenance_requests.filter((request) =>
        ["submitted", "under_review", "assigned", "in_progress"].includes(request.status),
      ).length,
      maintenanceStatus,
      upcomingOpportunities: store.opportunities.filter(
        (opportunity) => new Date(opportunity.deadline).getTime() > now,
      ).length,
      announcements: store.announcements.length,
      groups: store.mentor_groups.length,
      auditLogs: store.audit_logs.slice(0, 8),
    };
  }

  const supabase = await createSupabaseServerClient();
  const [profiles, prints, maintenance, opportunities, announcements, groups, logs] = await Promise.all([
    supabase.from("profiles").select("role"),
    supabase.from("print_requests").select("status, estimated_cost").limit(500),
    supabase.from("maintenance_requests").select("status").limit(500),
    supabase.from("opportunities").select("deadline").gte("deadline", new Date().toISOString()),
    supabase.from("announcements").select("id"),
    supabase.from("mentor_groups").select("id"),
    supabase
      .from("audit_logs")
      .select("*, actor:profiles!audit_logs_actor_id_fkey(id, full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const roleRows = profiles.data ?? [];
  const printRows = prints.data ?? [];
  const maintenanceRows = maintenance.data ?? [];
  const printStatus = printRows.reduce<Record<string, number>>((counts, row) => {
    const status = row.status as string;
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const maintenanceStatus = maintenanceRows.reduce<Record<string, number>>((counts, row) => {
    const status = row.status as string;
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    users: roleRows.length,
    students: roleRows.filter((row) => row.role === "student").length,
    faculty: roleRows.filter((row) => row.role === "faculty").length,
    admins: roleRows.filter((row) => row.role === "admin").length,
    activePrint: printRows.filter((row) => ["submitted", "queued", "processing"].includes(row.status as string))
      .length,
    readyPrint: printRows.filter((row) => row.status === "ready").length,
    totalPrint: printRows.length,
    printRevenue: printRows
      .filter((row) => row.status !== "cancelled")
      .reduce((total, row) => total + Number(row.estimated_cost ?? 0), 0),
    printStatus,
    pendingMaintenance: maintenanceRows.filter((row) =>
      ["submitted", "under_review", "assigned", "in_progress"].includes(row.status as string),
    ).length,
    maintenanceStatus,
    upcomingOpportunities: opportunities.data?.length ?? 0,
    announcements: announcements.data?.length ?? 0,
    groups: groups.data?.length ?? 0,
    auditLogs: (logs.data ?? []) as AuditLog[],
  };
}

export async function listUsers(filters: { q?: string; role?: string } = {}): Promise<Profile[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    return store.profiles
      .filter((profile) => (filters.role && filters.role !== "all" ? profile.role === filters.role : true))
      .filter((profile) => {
        if (!filters.q) return true;
        const needle = filters.q.toLowerCase();
        return (
          profile.full_name.toLowerCase().includes(needle) ||
          profile.email.toLowerCase().includes(needle) ||
          (profile.roll_number ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((profile) => ({
        ...profile,
        department: store.departments.find((department) => department.id === profile.department_id) ?? null,
        password: undefined,
      }));
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("profiles")
    .select("*, department:departments(*)")
    .order("full_name")
    .limit(200);
  if (filters.role && filters.role !== "all") query = query.eq("role", filters.role);
  if (filters.q) {
    const safe = filters.q.replace(/[%,()]/g, " ").trim();
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,roll_number.ilike.%${safe}%`);
  }
  const { data } = await query;
  return (data ?? []) as Profile[];
}

export async function updateUserRole(admin: Profile, userId: string, role: Role) {
  if (admin.role !== "admin") return { ok: false as const, error: "Administrator access required." };
  if (admin.id === userId) return { ok: false as const, error: "You cannot change your own role." };

  if (isDemoMode()) {
    const store = getDemoStore();
    const target = store.profiles.find((profile) => profile.id === userId);
    if (!target) return { ok: false as const, error: "User not found." };
    if (target.role === "admin" && role !== "admin") {
      const admins = store.profiles.filter((profile) => profile.role === "admin");
      if (admins.length <= 1) return { ok: false as const, error: "At least one administrator is required." };
    }
    const previous = target.role;
    target.role = role;
    target.updated_at = new Date().toISOString();
    await writeAuditLog(admin, "user.role_changed", "profiles", userId, { from: previous, to: role });
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("set_user_role", { target_user: userId, new_role: role });
    if (error) return { ok: false as const, error: error.message };
    await writeAuditLog(admin, "user.role_changed", "profiles", userId, { to: role });
  }
  return { ok: true as const };
}

export async function listAuditLogs(limit = 40): Promise<AuditLog[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    return store.audit_logs.slice(0, limit).map((log) => ({
      ...log,
      actor: store.profiles.find((profile) => profile.id === log.actor_id) ?? null,
    })) as AuditLog[];
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles!audit_logs_actor_id_fkey(id, full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditLog[];
}

export async function getDepartments() {
  if (isDemoMode()) return getDemoStore().departments;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("departments").select("*").order("name");
  return data ?? [];
}
