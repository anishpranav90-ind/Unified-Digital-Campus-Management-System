"use client";

import { useActionState } from "react";
import { Alert, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { addMaintenanceCommentAction } from "@/lib/actions/fixora";
import { EMPTY_FORM_STATE } from "@/lib/action-state";

export function CommentForm({
  requestId,
  isStaff,
}: {
  requestId: string;
  isStaff: boolean;
}) {
  const [state, formAction] = useActionState(addMaintenanceCommentAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-2 p-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="request_id" value={requestId} />
      <Textarea
        name="body"
        rows={2}
        required
        maxLength={1500}
        placeholder="Add a comment or ask for an update…"
        aria-label="Comment"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isStaff ? (
          <label className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <input type="checkbox" name="is_internal" className="h-3 w-3 accent-blue-600" />
            Internal note (hidden from student)
          </label>
        ) : (
          <span className="text-[10px] text-muted">You will be notified when the status changes.</span>
        )}
        <SubmitButton size="sm" variant="secondary" pendingText="Posting…">
          Add comment
        </SubmitButton>
      </div>
    </form>
  );
}
