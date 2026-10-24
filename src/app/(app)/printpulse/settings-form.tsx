"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePrintSettingsAction } from "@/lib/actions/printpulse";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { PrintSettings } from "@/types";

export function PrintSettingsForm({ settings }: { settings: PrintSettings }) {
  const [state, formAction] = useActionState(updatePrintSettingsAction, EMPTY_FORM_STATE);

  return (
    <form key={settings.updated_at} action={formAction} className="space-y-4 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="B&W single (₹)" htmlFor="bw_single">
          <Input id="bw_single" name="bw_single" type="number" min="0" step="0.5" defaultValue={settings.bw_single} />
        </Field>
        <Field label="B&W double (₹)" htmlFor="bw_double">
          <Input id="bw_double" name="bw_double" type="number" min="0" step="0.5" defaultValue={settings.bw_double} />
        </Field>
        <Field label="Color single (₹)" htmlFor="color_single">
          <Input id="color_single" name="color_single" type="number" min="0" step="0.5" defaultValue={settings.color_single} />
        </Field>
        <Field label="Color double (₹)" htmlFor="color_double">
          <Input id="color_double" name="color_double" type="number" min="0" step="0.5" defaultValue={settings.color_double} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Avg. processing (min)" htmlFor="avg_processing_minutes" hint="Used for wait estimates">
          <Input
            id="avg_processing_minutes"
            name="avg_processing_minutes"
            type="number"
            min="1"
            max="60"
            defaultValue={settings.avg_processing_minutes}
          />
        </Field>
        <Field label="Max pages per job" htmlFor="max_pages_per_job">
          <Input
            id="max_pages_per_job"
            name="max_pages_per_job"
            type="number"
            min="1"
            max="500"
            defaultValue={settings.max_pages_per_job}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-800">
        <strong>Printer mode: {settings.printer_mode}</strong>. Set it with the <code>PRINTER_MODE</code>{" "}
        environment variable. In simulated mode, marking a job “Ready for Collection” records a simulated
        output; no document is physically printed. CUPS/IPP support is an optional module that must be
        configured and verified before claiming real printing.
      </div>

      <SubmitButton pendingText="Saving pricing…">Save print settings</SubmitButton>
    </form>
  );
}
