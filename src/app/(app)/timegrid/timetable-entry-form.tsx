"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveTimetableEntryAction } from "@/lib/actions/timegrid";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { Classroom, Profile, Subject, TimetableEntry } from "@/types";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function TimetableEntryForm({
  subjects,
  classrooms,
  faculty,
  entry,
}: {
  subjects: Subject[];
  classrooms: Classroom[];
  faculty: Profile[];
  entry?: TimetableEntry | null;
}) {
  const [state, formAction] = useActionState(saveTimetableEntryAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="space-y-4 p-5" key={entry?.id ?? "new"}>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Subject" htmlFor="subject_id" required>
          <Select id="subject_id" name="subject_id" required defaultValue={entry?.subject_id ?? ""}>
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
        <Field label="Faculty" htmlFor="faculty_id" required>
          <Select id="faculty_id" name="faculty_id" required defaultValue={entry?.faculty_id ?? ""}>
            <option value="" disabled>
              Select faculty
            </option>
            {faculty.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Classroom" htmlFor="classroom_id" required>
          <Select id="classroom_id" name="classroom_id" required defaultValue={entry?.classroom_id ?? ""}>
            <option value="" disabled>
              Select room
            </option>
            {classrooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} · {room.building}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Day" htmlFor="day_of_week" required>
          <Select id="day_of_week" name="day_of_week" defaultValue={entry?.day_of_week ?? 1}>
            {DAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start time" htmlFor="start_time" required>
          <Input id="start_time" name="start_time" type="time" defaultValue={entry?.start_time?.slice(0, 5) ?? "09:00"} required />
        </Field>
        <Field label="End time" htmlFor="end_time" required>
          <Input id="end_time" name="end_time" type="time" defaultValue={entry?.end_time?.slice(0, 5) ?? "10:00"} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Semester" htmlFor="semester" required>
          <Select id="semester" name="semester" defaultValue={entry?.semester ?? 5}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
              <option key={semester} value={semester}>
                Semester {semester}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Section" htmlFor="section" required>
          <Input id="section" name="section" defaultValue={entry?.section ?? "A"} maxLength={12} required />
        </Field>
        <Field label="Academic year" htmlFor="academic_year" required>
          <Input id="academic_year" name="academic_year" defaultValue={entry?.academic_year ?? "2026-27"} required />
        </Field>
      </div>

      <div className="rounded-lg bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-700">
        The server rejects classroom double-bookings and overlapping faculty assignments before saving.
      </div>

      <SubmitButton pendingText="Checking conflicts…">
        {entry ? "Save changes" : "Add class to timetable"}
      </SubmitButton>
    </form>
  );
}
