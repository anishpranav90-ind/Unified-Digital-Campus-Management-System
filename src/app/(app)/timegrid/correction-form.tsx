"use client";

import { useActionState } from "react";
import { Alert, Field, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestCorrectionAction } from "@/lib/actions/timegrid";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { dayName, formatTime } from "@/lib/utils";
import type { TimetableEntry } from "@/types";

export function CorrectionForm({ entries }: { entries: TimetableEntry[] }) {
  const [state, formAction] = useActionState(requestCorrectionAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-3 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field label="Class" htmlFor="entry_id" required>
        <Select id="entry_id" name="entry_id" required defaultValue="">
          <option value="" disabled>
            Select one of your classes
          </option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {dayName(entry.day_of_week)} {formatTime(entry.start_time)} · {entry.subject?.code} ·{" "}
              {entry.classroom?.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Requested correction" htmlFor="reason" required>
        <Textarea
          id="reason"
          name="reason"
          rows={3}
          placeholder="Explain what needs to change and why (e.g. room clash, faculty meeting)…"
          required
        />
      </Field>
      <SubmitButton size="sm" variant="secondary" pendingText="Sending…">
        Send to timetable office
      </SubmitButton>
    </form>
  );
}
