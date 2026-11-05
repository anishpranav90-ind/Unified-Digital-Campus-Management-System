import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { Alert } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");
  const params = await searchParams;
  const callbackError = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <div>
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Welcome back</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Sign in to your campus</h2>
        <p className="mt-1.5 text-sm text-muted">
          Use your college account to open all six UniSync modules.
        </p>
      </div>

      {callbackError ? <Alert tone="error" className="mb-5">{callbackError}</Alert> : null}

      <LoginForm />

      <p className="mt-7 text-center text-xs text-muted">
        New to UniSync?{" "}
        <Link href="/register" className="font-semibold text-brand-blue hover:underline">
          Create a student account
        </Link>
      </p>
    </div>
  );
}
