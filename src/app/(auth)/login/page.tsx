import Link from "next/link";
import { ArrowRight, GraduationCap, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { getCurrentProfile } from "@/lib/session";
import { demoLoginAction } from "@/lib/actions/auth";
import { Alert } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const DEMO_ROLES = [
  { role: "student", label: "Student", email: "student@unisync.edu", icon: GraduationCap, tone: "bg-blue-50 text-blue-600" },
  { role: "faculty", label: "Faculty", email: "faculty@unisync.edu", icon: UserRound, tone: "bg-teal-50 text-teal-600" },
  { role: "admin", label: "Administrator", email: "admin@unisync.edu", icon: ShieldCheck, tone: "bg-orange-50 text-orange-600" },
];

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");
  const demo = isDemoMode();

  return (
    <div>
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Welcome back</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Sign in to your campus</h2>
        <p className="mt-1.5 text-sm text-muted">
          Use your college account to open all five UniSync modules.
        </p>
      </div>

      {demo ? (
        <Alert tone="info" className="mb-5">
          <strong>Demo mode.</strong> No Supabase project is connected yet, so the app runs on seeded
          in-memory data. Printer output is simulated.
        </Alert>
      ) : null}

      <LoginForm demo={demo} />

      {demo ? (
        <div className="mt-7 border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              One-click demo accounts
            </p>
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <UsersRound className="h-3 w-3" /> password: unisync123
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {DEMO_ROLES.map((item) => (
              <form key={item.role} action={demoLoginAction}>
                <input type="hidden" name="role" value={item.role} />
                <button
                  type="submit"
                  className="group flex w-full flex-col items-start gap-1.5 rounded-xl border border-line bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className={`rounded-lg p-1.5 ${item.tone}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-ink">{item.label}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted">
                    Open dashboard <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-7 text-center text-xs text-muted">
        New to UniSync?{" "}
        <Link href="/register" className="font-semibold text-brand-blue hover:underline">
          Create a student account
        </Link>
      </p>
    </div>
  );
}
