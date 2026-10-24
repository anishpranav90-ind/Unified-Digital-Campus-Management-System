"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { publishOpportunityAction } from "@/lib/actions/opportune";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { OPPORTUNITY_CATEGORIES } from "@/lib/constants";

export function OpportunityForm() {
  const [state, formAction] = useActionState(publishOpportunityAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-3 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label="Title" htmlFor="opp-title" required>
        <Input id="opp-title" name="title" placeholder="e.g. Smart India Hackathon 2026" required maxLength={140} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Organization" htmlFor="opp-org" required>
          <Input id="opp-org" name="organization" placeholder="Host / company" required maxLength={120} />
        </Field>
        <Field label="Category" htmlFor="opp-category" required>
          <Select id="opp-category" name="category" defaultValue="hackathon">
            {OPPORTUNITY_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor="opp-description" required>
        <Textarea id="opp-description" name="description" rows={4} placeholder="What is it, who is it for, what should students prepare?" required />
      </Field>
      <Field label="Eligibility" htmlFor="opp-eligibility">
        <Textarea id="opp-eligibility" name="eligibility" rows={2} placeholder="Years, branches, team size, CGPA…" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Location" htmlFor="opp-location">
          <Input id="opp-location" name="location" placeholder="Chennai / Online" />
        </Field>
        <Field label="Mode" htmlFor="opp-mode">
          <Select id="opp-mode" name="mode" defaultValue="offline">
            <option value="offline">Offline</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Apply by" htmlFor="opp-deadline" required>
          <Input id="opp-deadline" name="deadline" type="date" required />
        </Field>
        <Field label="Event start" htmlFor="opp-start">
          <Input id="opp-start" name="event_start" type="date" />
        </Field>
        <Field label="Event end" htmlFor="opp-end">
          <Input id="opp-end" name="event_end" type="date" />
        </Field>
      </div>
      <Field label="Application link" htmlFor="opp-url" hint="https:// only · shown with a warning before students leave UniSync" required>
        <Input id="opp-url" name="apply_url" type="url" placeholder="https://…" required />
      </Field>
      <Field label="Tags" htmlFor="opp-tags" hint="Comma separated, up to 8">
        <Input id="opp-tags" name="tags" placeholder="ai, team, prototype" />
      </Field>

      <div className="rounded-lg bg-violet-50 px-3 py-2 text-[10px] leading-relaxed text-violet-800">
        Publishing notifies students in-app. External links are validated server-side and must use http(s).
      </div>

      <SubmitButton pendingText="Publishing…">Publish opportunity</SubmitButton>
    </form>
  );
}
