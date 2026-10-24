import "server-only";
import type {
  Classroom,
  ExamSchedule,
  Profile,
  Subject,
  TimetableCorrection,
  TimetableEntry,
} from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyUsers, writeAuditLog } from "@/lib/data/helpers";
import { minutesFromTime } from "@/lib/utils";

export type ScheduleInput = {
  subject_id: string;
  faculty_id: string;
  classroom_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  semester: number;
  section: string;
  academic_year: string;
};

export type Conflict = { type: "classroom" | "faculty"; message: string };

export function findTimetableConflicts(
  entries: Pick<TimetableEntry, "id" | "classroom_id" | "faculty_id" | "day_of_week" | "start_time" | "end_time" | "academic_year">[],
  candidate: ScheduleInput,
): Conflict[] {
  const overlaps = (a: string, b: string, c: string, d: string) =>
    minutesFromTime(a) < minutesFromTime(d) && minutesFromTime(b) > minutesFromTime(c);

  const relevant = entries.filter(
    (entry) =>
      entry.id !== (candidate as TimetableEntry).id &&
      entry.day_of_week === candidate.day_of_week &&
      entry.academic_year === candidate.academic_year &&
      overlaps(entry.start_time, entry.end_time, candidate.start_time, candidate.end_time),
  );

  const conflicts: Conflict[] = [];
  if (relevant.some((entry) => entry.classroom_id === candidate.classroom_id)) {
    conflicts.push({
      type: "classroom",
      message: "That classroom is already booked during this time slot.",
    });
  }
  if (relevant.some((entry) => entry.faculty_id === candidate.faculty_id)) {
    conflicts.push({
      type: "faculty",
      message: "This faculty member already teaches another class during this time slot.",
    });
  }
  return conflicts;
}

async function withRelations(entries: TimetableEntry[]): Promise<TimetableEntry[]> {
  if (!isDemoMode()) return entries;
  const store = getDemoStore();
  return entries.map((entry) => ({
    ...entry,
    subject: store.subjects.find((subject) => subject.id === entry.subject_id) ?? null,
    faculty: store.profiles.find((profile) => profile.id === entry.faculty_id) ?? null,
    classroom: store.classrooms.find((room) => room.id === entry.classroom_id) ?? null,
  }));
}

export async function getTimetable(profile: Profile): Promise<TimetableEntry[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    let entries = store.timetable_entries.filter((entry) => entry.published);
    if (profile.role === "student") {
      entries = entries.filter((entry) => {
        const subject = store.subjects.find((item) => item.id === entry.subject_id);
        return (
          subject?.department_id === profile.department_id &&
          subject?.semester === profile.semester
        );
      });
    }
    if (profile.role === "faculty") {
      entries = entries.filter((entry) => entry.faculty_id === profile.id);
    }
    return withRelations(entries.sort((a, b) => a.day_of_week - b.day_of_week));
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("timetable_entries")
    .select(
      "*, subject:subjects(*), faculty:profiles!timetable_entries_faculty_id_fkey(id, full_name), classroom:classrooms(*)",
    )
    .eq("published", true)
    .order("day_of_week")
    .order("start_time")
    .limit(300);
  if (profile.role === "faculty") query = query.eq("faculty_id", profile.id);
  const { data } = await query;
  let entries = (data ?? []) as TimetableEntry[];
  if (profile.role === "student") {
    entries = entries.filter(
      (entry) =>
        entry.subject?.department_id === profile.department_id && entry.semester === profile.semester,
    );
  }
  return entries;
}

export async function getAllTimetableEntries(profile: Profile): Promise<TimetableEntry[]> {
  if (profile.role !== "admin") return getTimetable(profile);
  if (isDemoMode()) return withRelations([...getDemoStore().timetable_entries]);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("timetable_entries")
    .select(
      "*, subject:subjects(*), faculty:profiles!timetable_entries_faculty_id_fkey(id, full_name), classroom:classrooms(*)",
    )
    .order("day_of_week")
    .order("start_time")
    .limit(300);
  return (data ?? []) as TimetableEntry[];
}

export async function getTimetableReferenceData() {
  if (isDemoMode()) {
    const store = getDemoStore();
    return {
      subjects: store.subjects,
      classrooms: store.classrooms,
      faculty: store.profiles.filter(
        (profile) => profile.role === "faculty" || profile.role === "admin",
      ) as Profile[],
    };
  }
  const supabase = await createSupabaseServerClient();
  const [{ data: subjects }, { data: classrooms }, { data: faculty }] = await Promise.all([
    supabase.from("subjects").select("*").order("code"),
    supabase.from("classrooms").select("*").order("name"),
    supabase.from("profiles").select("*").in("role", ["faculty", "admin"]).order("full_name"),
  ]);
  return {
    subjects: (subjects ?? []) as Subject[],
    classrooms: (classrooms ?? []) as Classroom[],
    faculty: (faculty ?? []) as Profile[],
  };
}

async function notifyScheduleChange(entry: ScheduleInput, title: string, body: string) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const subject = store.subjects.find((item) => item.id === entry.subject_id);
    const ids = store.profiles
      .filter((profile) => {
        if (profile.role === "faculty") return profile.id === entry.faculty_id;
        if (profile.role !== "student") return false;
        return subject?.department_id === profile.department_id && profile.semester === entry.semester;
      })
      .map((profile) => profile.id);
    await notifyUsers(ids, { title, body, type: "timetable", link: "/timegrid" });
    return;
  }
  const supabase = await createSupabaseServerClient();
  const { data: subject } = await supabase
    .from("subjects")
    .select("department_id")
    .eq("id", entry.subject_id)
    .maybeSingle();
  const { data: students } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .eq("department_id", subject?.department_id ?? "")
    .eq("semester", entry.semester);
  const ids = (students ?? []).map((row) => row.id as string);
  ids.push(entry.faculty_id);
  await notifyUsers(ids, {
    title,
    body,
    type: "timetable",
    link: "/timegrid",
  });
}

export async function createTimetableEntry(profile: Profile, input: ScheduleInput) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can edit the timetable." };
  if (minutesFromTime(input.end_time) <= minutesFromTime(input.start_time)) {
    return { ok: false as const, error: "The end time must be after the start time." };
  }

  const existing = await getAllTimetableEntries({ ...profile, role: "admin" });
  const conflicts = findTimetableConflicts(existing, input);
  if (conflicts.length) return { ok: false as const, error: conflicts[0].message };

  let entryId = crypto.randomUUID();
  if (isDemoMode()) {
    const store = getDemoStore();
    store.timetable_entries.push({
      id: entryId,
      ...input,
      published: true,
      created_at: new Date().toISOString(),
    });
  } else {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("timetable_entries")
      .insert({ ...input, published: true })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    entryId = data.id as string;
  }

  await notifyScheduleChange(
    input,
    "Timetable updated",
    `A new class was added on the timetable for semester ${input.semester}.`,
  );
  await writeAuditLog(profile, "timetable.created", "timetable_entries", entryId, input);
  return { ok: true as const, id: entryId };
}

export async function updateTimetableEntry(profile: Profile, id: string, input: ScheduleInput) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can edit the timetable." };
  if (minutesFromTime(input.end_time) <= minutesFromTime(input.start_time)) {
    return { ok: false as const, error: "The end time must be after the start time." };
  }
  const existing = (await getAllTimetableEntries({ ...profile, role: "admin" })).filter((entry) => entry.id !== id);
  const conflicts = findTimetableConflicts(existing, input);
  if (conflicts.length) return { ok: false as const, error: conflicts[0].message };

  if (isDemoMode()) {
    const target = getDemoStore().timetable_entries.find((entry) => entry.id === id);
    if (!target) return { ok: false as const, error: "Timetable entry not found." };
    Object.assign(target, input);
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("timetable_entries").update(input).eq("id", id);
    if (error) return { ok: false as const, error: error.message };
  }
  await notifyScheduleChange(input, "Timetable changed", "A published class schedule has changed.");
  await writeAuditLog(profile, "timetable.updated", "timetable_entries", id, input);
  return { ok: true as const };
}

export async function setTimetablePublished(profile: Profile, id: string, published: boolean) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can publish the timetable." };
  if (isDemoMode()) {
    const target = getDemoStore().timetable_entries.find((entry) => entry.id === id);
    if (!target) return { ok: false as const, error: "Not found." };
    target.published = published;
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("timetable_entries").update({ published }).eq("id", id);
    if (error) return { ok: false as const, error: error.message };
  }
  await writeAuditLog(profile, published ? "timetable.published" : "timetable.unpublished", "timetable_entries", id);
  return { ok: true as const };
}

export async function deleteTimetableEntry(profile: Profile, id: string) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can delete timetable entries." };
  if (isDemoMode()) {
    const store = getDemoStore();
    store.timetable_entries = store.timetable_entries.filter((entry) => entry.id !== id);
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
  }
  await writeAuditLog(profile, "timetable.deleted", "timetable_entries", id);
  return { ok: true as const };
}

export async function getExamSchedule(profile: Profile): Promise<ExamSchedule[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    return store.exams
      .map((exam) => ({ ...exam, subject: store.subjects.find((subject) => subject.id === exam.subject_id) ?? null }))
      .filter((exam) => {
        if (profile.role !== "student") return true;
        return exam.subject?.department_id === profile.department_id && exam.semester === profile.semester;
      })
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("exam_schedules")
    .select("*, subject:subjects(*)")
    .order("exam_date")
    .limit(100);
  const exams = (data ?? []) as ExamSchedule[];
  if (profile.role !== "student") return exams;
  return exams.filter(
    (exam) => exam.subject?.department_id === profile.department_id && exam.semester === profile.semester,
  );
}

export async function createExam(profile: Profile, input: Omit<ExamSchedule, "id" | "created_at" | "subject">) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can publish exam schedules." };
  if (isDemoMode()) {
    getDemoStore().exams.push({
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("exam_schedules").insert(input);
    if (error) return { ok: false as const, error: error.message };
  }
  await writeAuditLog(profile, "exam.created", "exam_schedules", null, { ...input });
  return { ok: true as const };
}

export async function deleteExam(profile: Profile, id: string) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can edit exam schedules." };
  if (isDemoMode()) {
    getDemoStore().exams = getDemoStore().exams.filter((exam) => exam.id !== id);
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("exam_schedules").delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export async function requestTimetableCorrection(profile: Profile, entryId: string, reason: string) {
  if (profile.role !== "faculty") {
    return { ok: false as const, error: "Correction requests are available to faculty members." };
  }
  if (reason.trim().length < 10) return { ok: false as const, error: "Describe the correction in at least 10 characters." };

  if (isDemoMode()) {
    const store = getDemoStore();
    store.timetable_corrections.push({
      id: crypto.randomUUID(),
      entry_id: entryId,
      requested_by: profile.id,
      reason,
      status: "pending",
      admin_note: null,
      created_at: new Date().toISOString(),
    });
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("timetable_correction_requests")
      .insert({ entry_id: entryId, requested_by: profile.id, reason });
    if (error) return { ok: false as const, error: error.message };
  }
  await writeAuditLog(profile, "timetable.correction_requested", "timetable_entries", entryId, { reason });
  return { ok: true as const };
}

export async function listTimetableCorrections(profile: Profile): Promise<TimetableCorrection[]> {
  if (profile.role !== "admin") return [];
  if (isDemoMode()) {
    const store = getDemoStore();
    return store.timetable_corrections.map((correction) => ({
      ...correction,
      entry: store.timetable_entries.find((entry) => entry.id === correction.entry_id) ?? null,
      requester: store.profiles.find((person) => person.id === correction.requested_by) ?? null,
    }));
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("timetable_correction_requests")
    .select(
      "*, entry:timetable_entries(*, subject:subjects(*), classroom:classrooms(*)), requester:profiles(id, full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as TimetableCorrection[];
}

export async function resolveTimetableCorrection(profile: Profile, id: string, note: string) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can resolve corrections." };
  if (isDemoMode()) {
    const store = getDemoStore();
    const target = store.timetable_corrections.find((correction) => correction.id === id);
    if (target) {
      target.status = "resolved";
      target.admin_note = note;
    }
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("timetable_correction_requests")
      .update({ status: "resolved", admin_note: note })
      .eq("id", id);
    if (error) return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}
