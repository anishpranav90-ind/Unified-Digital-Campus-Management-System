"use client";

import { useActionState, useState } from "react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createGroupAction } from "@/lib/actions/mentorloop";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { Profile } from "@/types";

export function GroupForm({
  students,
  faculty,
  profile,
}: {
  students: { id: string; full_name: string; email: string }[];
  faculty: Profile[];
  profile: Profile;
}) {
  const [state, formAction] = useActionState(createGroupAction, EMPTY_FORM_STATE);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <form action={formAction} className="space-y-4 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="Group name" htmlFor="group-name" required>
        <Input id="group-name" name="name" placeholder="e.g. DBMS Doubt Clearing" required maxLength={80} />
      </Field>
      <Field label="Purpose" htmlFor="group-description" required>
        <Textarea
          id="group-description"
          name="description"
          rows={3}
          placeholder="What will this group discuss? What are the expectations?"
          required
          maxLength={500}
        />
      </Field>

      {profile.role === "admin" ? (
        <Field label="Mentor" htmlFor="mentor_id" required>
          <Select id="mentor_id" name="mentor_id" required defaultValue="">
            <option value="" disabled>
              Select a mentor
            </option>
            {faculty.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="mentor_id" value={profile.id} />
      )}
      {profile.department_id ? <input type="hidden" name="department_id" value={profile.department_id} /> : null}

      <Field label="Add students" htmlFor="student_ids" hint={`${selected.length} selected · students only see groups they belong to`}>
        <div className="scroll-thin max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
          {students.length === 0 ? (
            <p className="p-2 text-[10px] text-muted">No student profiles available yet.</p>
          ) : (
            students.map((student) => (
              <label
                key={student.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="student_ids"
                  value={student.id}
                  checked={selected.includes(student.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, student.id]
                        : current.filter((id) => id !== student.id),
                    )
                  }
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
                />
                <span className="min-w-0 flex-1 truncate">{student.full_name}</span>
                <span className="text-[9px] text-muted">{student.email}</span>
              </label>
            ))
          )}
        </div>
      </Field>

      <div className="rounded-lg bg-teal-50 px-3 py-2 text-[10px] leading-relaxed text-teal-800">
        Only the mentor and administrators can add or remove members. Messages are visible to members only.
      </div>

      <SubmitButton pendingText="Creating group…">Create mentor group</SubmitButton>
    </form>
  );
}
