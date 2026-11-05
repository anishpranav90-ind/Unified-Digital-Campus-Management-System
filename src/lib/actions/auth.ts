"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { APP_URL, isDemoMode } from "@/lib/env";
import { DEMO_COOKIE } from "@/lib/demo/constants";
import { DEMO_PASSWORD, demoProfileByEmail, getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema, profileSchema } from "@/lib/validations";
import { requireProfile } from "@/lib/session";

export type AuthState = { error?: string; success?: string };

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7,
};

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  if (isDemoMode()) {
    const profile = demoProfileByEmail(parsed.data.email);
    const expected = profile?.password || DEMO_PASSWORD;
    if (!profile || parsed.data.password !== expected) {
      return { error: "Invalid email or password. Use one of the three accounts shown above." };
    }
    const cookieStore = await cookies();
    cookieStore.set(DEMO_COOKIE, profile.id, COOKIE_OPTIONS);
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Confirm your email using the link sent after registration, then sign in with the same account.",
      };
    }
    return { error: error.message };
  }
  redirect("/dashboard");
}

export async function demoLoginAction(formData: FormData) {
  if (!isDemoMode()) redirect("/login");
  const role = String(formData.get("role") ?? "student");
  const email =
    role === "admin" ? "admin@unisync.edu" : role === "faculty" ? "faculty@unisync.edu" : "student@unisync.edu";
  const profile = demoProfileByEmail(email);
  if (!profile) redirect("/login?error=Demo+account+unavailable");
  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, profile.id, COOKIE_OPTIONS);
  redirect("/dashboard");
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roll_number: formData.get("roll_number") ?? "",
    department_id: formData.get("department_id") ?? "",
    semester: formData.get("semester") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    if (demoProfileByEmail(parsed.data.email)) {
      return { error: "An account with this email already exists." };
    }
    const id = crypto.randomUUID();
    const department = store.departments.find((d) => d.id === parsed.data.department_id) ?? null;
    store.profiles.push({
      id,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      role: "student",
      department_id: department?.id ?? null,
      department,
      roll_number: parsed.data.roll_number || null,
      phone: null,
      avatar_url: null,
      interests: [],
      semester: parsed.data.semester ?? null,
      password: parsed.data.password,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const cookieStore = await cookies();
    cookieStore.set(DEMO_COOKIE, id, COOKIE_OPTIONS);
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  let hasSession = false;
  let identityCount: number | undefined;
  try {
    const result = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: new URL("/auth/callback", APP_URL).toString(),
        data: {
          full_name: parsed.data.full_name,
          roll_number: parsed.data.roll_number || null,
          department_id: parsed.data.department_id || null,
          semester: parsed.data.semester ?? null,
        },
      },
    });
    const { error } = result;

    if (error) {
      if (error.status === 504 || /gateway timeout/i.test(error.message)) {
        return {
          error:
            "Supabase timed out while creating the account. It may still have been created—try signing in with this email and password before registering again. If sign-in also fails, check Supabase Auth email/SMTP settings.",
        };
      }
      return { error: error.message };
    }
    hasSession = Boolean(result.data.session);
    identityCount = result.data.user?.identities?.length;
  } catch (error) {
    if (error instanceof Error) {
      return {
        error:
          "Could not reach Supabase Auth to finish registration. Check your connection and Supabase Auth status, then try signing in before retrying registration.",
      };
    }
    throw error;
  }

  if (identityCount === 0) {
    return {
      error: "This email may already have an account. Try signing in or use the password reset option.",
    };
  }
  if (!hasSession) {
    return {
      success: "Account created. Check your inbox and confirm your email before signing in with this same email and password.",
    };
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  if (isDemoMode()) {
    const cookieStore = await cookies();
    cookieStore.delete(DEMO_COOKIE);
    redirect("/");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateProfileAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const profile = await requireProfile();
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") ?? "",
    roll_number: formData.get("roll_number") ?? "",
    semester: formData.get("semester") || undefined,
    interests: formData.getAll("interests").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    const target = store.profiles.find((item) => item.id === profile.id);
    if (!target) return { error: "Profile not found." };
    Object.assign(target, {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      roll_number: parsed.data.roll_number || null,
      semester: parsed.data.semester ?? null,
      interests: parsed.data.interests ?? [],
      updated_at: new Date().toISOString(),
    });
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    return { success: "Profile updated." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      roll_number: parsed.data.roll_number || null,
      semester: parsed.data.semester ?? null,
      interests: parsed.data.interests ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);
  if (error) return { error: error.message };
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Profile updated." };
}
