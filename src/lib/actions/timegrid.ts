"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/action-state";
import { requireProfile } from "@/lib/session";
import { examSchema, timetableSchema } from "@/lib/validations";
import {
  createExam,
  createTimetableEntry,
  deleteExam,
  deleteTimetableEntry,
  requestTimetableCorrection,
  resolveTimetableCorrection,
  setTimetablePublished,
  updateTimetableEntry,
} from "@/lib/data/timegrid";

export async function saveTimetableEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = timetableSchema.safeParse({
    subject_id: formData.get("subject_id"),
    faculty_id: formData.get("faculty_id"),
    classroom_id: formData.get("classroom_id"),
    day_of_week: formData.get("day_of_week"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    semester: formData.get("semester"),
    section: formData.get("section"),
    academic_year: formData.get("academic_year"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the timetable details." };

  const id = String(formData.get("id") ?? "");
  const result = id
    ? await updateTimetableEntry(profile, id, parsed.data)
    : await createTimetableEntry(profile, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/timegrid");
  revalidatePath("/dashboard");
  return { success: id ? "Timetable entry updated." : "Class added to the timetable." };
}

export async function deleteTimetableEntryAction(formData: FormData) {
  const profile = await requireProfile();
  await deleteTimetableEntry(profile, String(formData.get("id") ?? ""));
  revalidatePath("/timegrid");
}

export async function toggleTimetablePublishedAction(formData: FormData) {
  const profile = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const published = String(formData.get("published")) === "true";
  await setTimetablePublished(profile, id, published);
  revalidatePath("/timegrid");
}

export async function createExamAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = examSchema.safeParse({
    subject_id: formData.get("subject_id"),
    exam_date: formData.get("exam_date"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    room: formData.get("room"),
    exam_type: formData.get("exam_type"),
    semester: formData.get("semester"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the exam details." };
  const result = await createExam(profile, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/timegrid");
  return { success: "Examination added to the schedule." };
}

export async function deleteExamAction(formData: FormData) {
  const profile = await requireProfile();
  await deleteExam(profile, String(formData.get("id") ?? ""));
  revalidatePath("/timegrid");
}

export async function requestCorrectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const entryId = String(formData.get("entry_id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!entryId) return { error: "Select a timetable entry." };
  const result = await requestTimetableCorrection(profile, entryId, reason);
  if (!result.ok) return { error: result.error };
  revalidatePath("/timegrid");
  return { success: "Correction request sent to the timetable office." };
}

export async function resolveCorrectionAction(formData: FormData) {
  const profile = await requireProfile();
  await resolveTimetableCorrection(
    profile,
    String(formData.get("id") ?? ""),
    String(formData.get("note") ?? "Reviewed and resolved."),
  );
  revalidatePath("/timegrid");
}
