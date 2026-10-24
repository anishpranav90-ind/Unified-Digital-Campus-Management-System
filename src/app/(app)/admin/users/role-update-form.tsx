"use client";

import { useActionState } from "react";
import { Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateUserRoleAction } from "@/lib/actions/admin";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { Role } from "@/types";

export function RoleUpdateForm({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: Role;
  isSelf: boolean;
}) {
  const [state, formAction] = useActionState(updateUserRoleAction, EMPTY_FORM_STATE);

  if (isSelf) {
    return <span className="text-[10px] text-muted">Your account</span>;
  }

  return (
    <form key={role} action={formAction} className="space-y-1.5">
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex items-center gap-1.5">
        <Select name="role" defaultValue={role} className="h-8 w-32 text-[11px]" aria-label="User role">
          <option value="student">Student</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Administrator</option>
        </Select>
        <SubmitButton size="sm" variant="secondary" pendingText="Saving…">
          Save
        </SubmitButton>
      </div>
      {state.error ? <p className="max-w-44 text-[9px] text-red-600">{state.error}</p> : null}
      {state.success ? <p className="max-w-44 text-[9px] text-emerald-600">{state.success}</p> : null}
    </form>
  );
}
