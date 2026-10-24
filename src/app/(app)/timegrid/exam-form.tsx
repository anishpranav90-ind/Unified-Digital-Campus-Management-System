"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createExamAction } from "@/lib/actions/timegrid";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { Subject } from "@/types";

export function ExamForm({ subjects }: { subjects: Subject[] }) {
  const [state, formAction] = useActionState(createExamAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-3 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field label="Subject" htmlFor="exam_subject" required>
        <Select id="exam_subject" name="subject_id" required defaultValue="">
          <option value="" disabled>
            Select subject
          </option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} · {subject.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date" htmlFor="exam_date" required>
          <Input id="exam_date" name="exam_date" type="date" required />
        </Field>
        <Field label="Start" htmlFor="exam_start" required>
          <Input id="exam_start" name="start_time" type="time" defaultValue="09:30" required />
        </Field>
        <Field label="End" htmlFor="exam_end" required>
          <Input id="exam_end" name="end_time" type="time" defaultValue="11:30" required />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Room" htmlFor="exam_room" required>
          <Input id="exam_room" name="room" placeholder="A-201" required />
        </Field>
        <Field label="Type" htmlFor="exam_type" required>
          <Select id="exam_type" name="exam_type" defaultValue="midterm">
            <option value="midterm">Midterm</option>
            <option value="end_semester">End semester</option>
            <option value="practical">Practical</option>
            <option value="viva">Viva</option>
          </Select>
        </Field>
        <Field label="Semester" htmlFor="exam_semester" required>
          <Select id="exam_semester" name="semester" defaultValue={5}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
              <option key={semester} value={semester}>
                Semester {semester}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SubmitButton size="sm" pendingText="Publishing…">
        Add examination
      </SubmitButton>
    </form>
  );
}
