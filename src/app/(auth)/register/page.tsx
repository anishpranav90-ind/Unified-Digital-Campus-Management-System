import Link from "next/link";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { getCurrentProfile } from "@/lib/session";
import { getDepartments } from "@/lib/data/admin";
import { Alert } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");
  const departments = await getDepartments();
  const demo = isDemoMode();

  return (
    <div>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Join UniSync</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Create your student account</h2>
        <p className="mt-1.5 text-sm text-muted">
          One account gives you print queues, timetables, mentor groups, opportunities and maintenance.
        </p>
      </div>

      {demo ? (
        <Alert tone="info" className="mb-5">
          <strong>Demo mode.</strong> Accounts you create are stored in server memory until restart. Real
          deployments use Supabase Auth and a database trigger creates the matching profile.
        </Alert>
      ) : null}

      <RegisterForm departments={departments} />

      <p className="mt-6 text-center text-xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-blue hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
