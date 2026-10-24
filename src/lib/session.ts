import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/types";
import type { Profile } from "@/types";
import { isDemoMode } from "@/lib/env";
import { DEMO_COOKIE } from "@/lib/demo/constants";
import { demoProfileById, getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export { DEMO_COOKIE };

function withDepartment(profile: Profile): Profile {
  const store = getDemoStore();
  return {
    ...profile,
    department: store.departments.find((department) => department.id === profile.department_id) ?? null,
  };
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (isDemoMode()) {
    const cookieStore = await cookies();
    const id = cookieStore.get(DEMO_COOKIE)?.value;
    const profile = demoProfileById(id);
    if (!profile) return null;
    const safe = Object.fromEntries(
      Object.entries(profile).filter(([key]) => key !== "password"),
    ) as Profile;
    return withDepartment(safe);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*, department:departments(*)")
    .eq("id", user.id)
    .maybeSingle();

  if (data) return data as Profile;

  // The auth trigger normally creates this row. Recover if it is missing.
  const fallback = {
    id: user.id,
    full_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Student",
    email: user.email ?? "",
    role: "student" as Role,
    department_id: null,
    roll_number: null,
    phone: null,
    avatar_url: null,
    interests: [],
    semester: null,
  };
  const { data: created } = await supabase.from("profiles").insert(fallback).select("*").maybeSingle();
  return (created as Profile) ?? { ...fallback, created_at: "", updated_at: "" };
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard");
  return profile;
}

export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/dashboard");
  return profile;
}

export function canManageCampus(role: Role) {
  return role === "admin";
}

export function canPublish(role: Role) {
  return role === "admin" || role === "faculty";
}

export async function getCurrentEmail() {
  if (isDemoMode()) {
    const cookieStore = await cookies();
    return demoProfileById(cookieStore.get(DEMO_COOKIE)?.value)?.email ?? null;
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}
