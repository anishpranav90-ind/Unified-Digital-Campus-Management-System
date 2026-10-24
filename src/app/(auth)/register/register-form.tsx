"use client";

import { useActionState, useState } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { registerAction } from "@/lib/actions/auth";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { Department } from "@/types";

export function RegisterForm({ departments }: { departments: Department[] }) {
  const [state, formAction] = useActionState(registerAction, EMPTY_FORM_STATE);
  const [mismatch, setMismatch] = useState("");

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const password = (form.elements.namedItem("password") as HTMLInputElement).value;
        const confirm = (form.elements.namedItem("confirm_password") as HTMLInputElement).value;
        if (password !== confirm) {
          event.preventDefault();
          setMismatch("Passwords do not match.");
          return;
        }
        setMismatch("");
      }}
    >
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {mismatch ? <Alert tone="error">{mismatch}</Alert> : null}

      <Field label="Full name" htmlFor="full_name" required>
        <Input id="full_name" name="full_name" placeholder="Aarav Sharma" autoComplete="name" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Roll number" htmlFor="roll_number" hint="Students only">
          <Input id="roll_number" name="roll_number" placeholder="CS22B001" />
        </Field>
        <Field label="Semester" htmlFor="semester">
          <Select id="semester" name="semester" defaultValue="5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
              <option key={semester} value={semester}>
                Semester {semester}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Department" htmlFor="department_id" required>
        <Select id="department_id" name="department_id" required defaultValue="">
          <option value="" disabled>
            Select your department
          </option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="College email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@unisync.edu" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" htmlFor="password" hint="8+ characters" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm_password" required>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-muted">
        New registrations are created with the <strong>student</strong> role. Faculty and administrator
        access is granted by a campus administrator. Roles can never be self-assigned.
      </p>

      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
