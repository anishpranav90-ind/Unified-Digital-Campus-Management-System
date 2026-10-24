"use client";

import { useActionState, useState } from "react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createMaintenanceRequestAction } from "@/lib/actions/fixora";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { BUILDINGS, MAINTENANCE_CATEGORIES, MAX_IMAGE_BYTES } from "@/lib/constants";

export function MaintenanceForm() {
  const [state, formAction] = useActionState(createMaintenanceRequestAction, EMPTY_FORM_STATE);
  const [photoLabel, setPhotoLabel] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field label="Issue title" htmlFor="issue-title" required>
        <Input
          id="issue-title"
          name="title"
          placeholder="e.g. Projector not powering on in C-102"
          maxLength={140}
          required
        />
      </Field>
      <Field label="Describe the issue" htmlFor="issue-description" required>
        <Textarea
          id="issue-description"
          name="description"
          rows={4}
          placeholder="What is broken? Since when? What have you already tried?"
          maxLength={3000}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="issue-category" required>
          <Select id="issue-category" name="category" required defaultValue="">
            <option value="" disabled>
              Select category
            </option>
            {MAINTENANCE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Building" htmlFor="issue-building" required>
          <Select id="issue-building" name="building" required defaultValue="">
            <option value="" disabled>
              Select building
            </option>
            {BUILDINGS.map((building) => (
              <option key={building} value={building}>
                {building}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Room or exact location" htmlFor="issue-room" required>
        <Input id="issue-room" name="room" placeholder="e.g. C-102, second floor" maxLength={80} required />
      </Field>

      <Field label="Photo (optional)" htmlFor="photo" hint="PNG, JPG or WebP · max 5 MB">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return setPhotoLabel("");
              if (file.size > MAX_IMAGE_BYTES) {
                setPhotoLabel("That image is larger than 5 MB.");
                return;
              }
              setPhotoLabel(`${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
            }}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-navy-800"
          />
          {photoLabel ? <p className="mt-2 text-[10px] text-slate-500">{photoLabel}</p> : null}
        </div>
      </Field>

      <div className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800">
        A unique complaint ID (FX-…) is generated on submission. Every status change is recorded in the
        complaint history, and you will be notified when the status changes.
      </div>

      <SubmitButton pendingText="Submitting complaint…">Submit complaint</SubmitButton>
    </form>
  );
}
