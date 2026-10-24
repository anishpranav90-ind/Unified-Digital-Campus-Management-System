"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction } from "@/lib/actions/auth";
import { EMPTY_FORM_STATE } from "@/lib/action-state";

export function LoginForm({ demo }: { demo: boolean }) {
  const [state, formAction] = useActionState(loginAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="Email address" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@unisync.edu"
          defaultValue={demo ? "student@unisync.edu" : ""}
          required
        />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          defaultValue={demo ? "unisync123" : ""}
          required
          minLength={6}
        />
      </Field>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in to UniSync
      </SubmitButton>
    </form>
  );
}
