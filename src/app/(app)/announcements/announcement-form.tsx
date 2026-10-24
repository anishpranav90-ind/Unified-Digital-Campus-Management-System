"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { publishAnnouncementAction } from "@/lib/actions/announcements";
import { EMPTY_FORM_STATE } from "@/lib/action-state";

export function AnnouncementForm() {
  const [state, formAction] = useActionState(publishAnnouncementAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-4 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field label="Title" htmlFor="announcement-title" required>
        <Input id="announcement-title" name="title" placeholder="e.g. Mid-semester exam timetable published" required />
      </Field>
      <Field label="Details" htmlFor="announcement-body" required>
        <Textarea
          id="announcement-body"
          name="body"
          rows={5}
          placeholder="Share the full notice, dates and any action students need to take…"
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="announcement-category" required>
          <Select id="announcement-category" name="category" defaultValue="academic">
            <option value="general">General</option>
            <option value="academic">Academic</option>
            <option value="exam">Examination</option>
            <option value="event">Event</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
        <Field label="Audience" htmlFor="announcement-audience" required>
          <Select id="announcement-audience" name="audience" defaultValue="students">
            <option value="all">Everyone</option>
            <option value="students">Students only</option>
            <option value="faculty">Faculty only</option>
            <option value="admins">Administrators only</option>
          </Select>
        </Field>
      </div>
      <p className="text-[10px] leading-relaxed text-muted">
        Publishing creates persistent in-app notifications for the selected audience. Attachments can be
        added through the announcement-attachments bucket once Supabase Storage is configured.
      </p>
      <SubmitButton className="w-full" pendingText="Publishing…">
        Publish announcement
      </SubmitButton>
    </form>
  );
}
