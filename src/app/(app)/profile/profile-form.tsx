"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfileAction } from "@/lib/actions/auth";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { INTEREST_OPTIONS } from "@/lib/constants";
import type { Profile } from "@/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateProfileAction, EMPTY_FORM_STATE);

  return (
    <form key={profile.updated_at} action={formAction} className="space-y-4 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="profile-name" required>
          <Input id="profile-name" name="full_name" defaultValue={profile.full_name} required />
        </Field>
        <Field label="Email" htmlFor="profile-email" hint="Managed by authentication">
          <Input id="profile-email" value={profile.email} disabled readOnly />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Roll number" htmlFor="profile-roll">
          <Input id="profile-roll" name="roll_number" defaultValue={profile.roll_number ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="profile-phone">
          <Input id="profile-phone" name="phone" defaultValue={profile.phone ?? ""} placeholder="+91 …" />
        </Field>
        <Field label="Semester" htmlFor="profile-semester">
          <Select id="profile-semester" name="semester" defaultValue={profile.semester ? String(profile.semester) : ""}>
            <option value="">Not applicable</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
              <option key={semester} value={semester}>
                Semester {semester}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-slate-700">Opportunity interests</legend>
        <p className="mb-2 text-[10px] text-muted">
          Used for simple category-based recommendations in Opportune. No paid AI service is involved.
        </p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <label
              key={interest}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[11px] font-medium capitalize text-slate-600 has-checked:border-blue-300 has-checked:bg-blue-50 has-checked:text-blue-700"
            >
              <input
                type="checkbox"
                name="interests"
                value={interest}
                defaultChecked={profile.interests?.includes(interest)}
                className="h-3 w-3 accent-blue-600"
              />
              {interest.replace("_", " ")}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}
