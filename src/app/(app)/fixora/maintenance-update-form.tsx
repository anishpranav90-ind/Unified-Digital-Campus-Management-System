"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateMaintenanceRequestAction } from "@/lib/actions/fixora";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { MaintenanceRequest } from "@/types";

export function MaintenanceUpdateForm({
  request,
  assignees,
}: {
  request: MaintenanceRequest;
  assignees: { id: string; full_name: string }[];
}) {
  const [state, formAction] = useActionState(updateMaintenanceRequestAction, EMPTY_FORM_STATE);

  return (
    // Remount when the record changes so the uncontrolled fields pick up the saved
    // values instead of React's post-action reset to the values from first render.
    <form key={request.updated_at} action={formAction} className="space-y-3 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="id" value={request.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status" htmlFor="maintenance-status" required>
          <Select id="maintenance-status" name="status" defaultValue={request.status}>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="maintenance-priority" required>
          <Select id="maintenance-priority" name="priority" defaultValue={request.priority}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
      </div>

      <Field label="Assign to" htmlFor="assigned_to">
        <Select id="assigned_to" name="assigned_to" defaultValue={request.assigned_to ?? ""}>
          <option value="">Unassigned</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.full_name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Progress note" htmlFor="maintenance-note" hint="Recorded in the visible complaint history">
        <Textarea
          id="maintenance-note"
          name="note"
          rows={3}
          defaultValue={request.resolution_note ?? ""}
          placeholder="What was checked, what is being done, or why it was rejected…"
        />
      </Field>

      <Field label="Resolution evidence (optional)" htmlFor="resolution_photo" hint="PNG/JPG/WebP · max 5 MB">
        <Input id="resolution_photo" name="resolution_photo" type="file" accept="image/png,image/jpeg,image/webp" />
      </Field>

      <SubmitButton size="sm" pendingText="Updating…">
        Save & notify student
      </SubmitButton>
    </form>
  );
}
