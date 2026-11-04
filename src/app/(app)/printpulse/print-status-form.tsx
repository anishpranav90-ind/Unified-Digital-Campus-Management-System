"use client";

import { useActionState } from "react";
import { Alert, Field, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePrintStatusAction } from "@/lib/actions/printpulse";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { PRINT_STATUS_META } from "@/lib/constants";
import type { PrintRequest } from "@/types";

export function PrintStatusForm({ request }: { request: PrintRequest }) {
  const [state, formAction] = useActionState(updatePrintStatusAction, EMPTY_FORM_STATE);

  return (
    <form key={request.updated_at} action={formAction} className="space-y-3 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="id" value={request.id} />
      <Field label="Job status" htmlFor="status" required>
        <Select id="status" name="status" defaultValue={request.status}>
          {Object.entries(PRINT_STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note for the student" htmlFor="note" hint="Optional, shown with the notification">
        <Textarea id="note" name="note" rows={2} defaultValue={request.notes ?? ""} />
      </Field>
      <SubmitButton pendingText="Updating…" size="sm">
        Update print job
      </SubmitButton>
      <p className="text-[10px] text-muted">
        In simulated printer mode, changing status only updates the digital queue. No physical output is
        produced.
      </p>
    </form>
  );
}
