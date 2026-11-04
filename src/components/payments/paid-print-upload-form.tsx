"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { attachPaidPrintFileAction } from "@/lib/actions/printpulse";

export function PaidPrintUploadForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(attachPaidPrintFileAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="id" value={requestId} />
      <div>
        <h3 className="text-sm font-semibold text-emerald-950">Payment verified — upload your PDF</h3>
        <p className="mt-1 text-xs text-emerald-800">
          The amount is verified. Upload the configured PDF to release the request to the print queue.
        </p>
      </div>
      <Field label="PDF document" htmlFor="paid-print-file" required>
        <Input
          id="paid-print-file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
          className="bg-white"
        />
      </Field>
      <SubmitButton pendingText="Uploading securely…" variant="accent">
        Upload PDF and join queue
      </SubmitButton>
    </form>
  );
}
