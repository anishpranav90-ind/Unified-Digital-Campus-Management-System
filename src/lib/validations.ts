import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(72),
  roll_number: z.string().trim().max(24).optional().or(z.literal("")),
  department_id: z.string().uuid("Select a department.").optional().or(z.literal("")),
  semester: z.coerce.number().int().min(1).max(8).optional(),
});

export const printRequestSchema = z.object({
  document_name: z.string().trim().min(3, "Give the document a name.").max(120),
  pages: z.coerce.number().int().min(1, "At least one page is required.").max(100),
  page_range: z.string().trim().max(40).optional().or(z.literal("")),
  copies: z.coerce.number().int().min(1).max(20),
  color_mode: z.enum(["bw", "color"]),
  sides: z.enum(["single", "double"]),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const printStatusSchema = z.enum([
  "submitted",
  "queued",
  "processing",
  "ready",
  "completed",
  "cancelled",
  "failed",
]);

export const printSettingsSchema = z.object({
  bw_single: z.coerce.number().min(0).max(100),
  bw_double: z.coerce.number().min(0).max(100),
  color_single: z.coerce.number().min(0).max(100),
  color_double: z.coerce.number().min(0).max(100),
  avg_processing_minutes: z.coerce.number().min(1).max(60),
  max_pages_per_job: z.coerce.number().int().min(1).max(500),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(5, "Add a clear title.").max(140),
  body: z.string().trim().min(10, "Add the announcement details.").max(4000),
  category: z.enum(["general", "academic", "exam", "event", "urgent"]),
  audience: z.enum(["all", "students", "faculty", "admins"]),
});

export const timetableSchema = z.object({
  subject_id: z.string().uuid(),
  faculty_id: z.string().uuid(),
  classroom_id: z.string().uuid(),
  day_of_week: z.coerce.number().int().min(1).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  semester: z.coerce.number().int().min(1).max(8),
  section: z.string().trim().min(1).max(12),
  academic_year: z.string().trim().min(7).max(9),
});

export const examSchema = z.object({
  subject_id: z.string().uuid(),
  exam_date: z.string().min(8),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().trim().min(1).max(60),
  exam_type: z.enum(["midterm", "end_semester", "practical", "viva"]),
  semester: z.coerce.number().int().min(1).max(8),
});

export const groupSchema = z.object({
  name: z.string().trim().min(3, "Name the group.").max(80),
  description: z.string().trim().min(5, "Describe the group's purpose.").max(500),
  mentor_id: z.string().uuid(),
  department_id: z.string().uuid().optional().or(z.literal("")),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message.").max(2000),
});

export const opportunitySchema = z.object({
  title: z.string().trim().min(4, "Add a title.").max(140),
  organization: z.string().trim().min(2, "Add the organization.").max(120),
  category: z.enum([
    "hackathon",
    "internship",
    "workshop",
    "technical_event",
    "competition",
    "seminar",
    "placement",
    "scholarship",
  ]),
  description: z.string().trim().min(20, "Describe the opportunity.").max(4000),
  eligibility: z.string().trim().max(1000).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  mode: z.enum(["online", "offline", "hybrid"]).optional(),
  deadline: z.string().min(8, "Set an application deadline."),
  event_start: z.string().optional().or(z.literal("")),
  event_end: z.string().optional().or(z.literal("")),
  apply_url: z.string().url("Enter a valid application URL.").refine((value) => value.startsWith("https://") || value.startsWith("http://"), "Only http(s) links are allowed."),
  tags: z.string().max(200).optional().or(z.literal("")),
});

export const maintenanceSchema = z.object({
  title: z.string().trim().min(5, "Add a short issue title.").max(140),
  description: z.string().trim().min(15, "Describe the issue in a little more detail.").max(3000),
  category: z.string().trim().min(2).max(80),
  building: z.string().trim().min(2, "Select a building.").max(80),
  room: z.string().trim().min(1, "Add the room or location.").max(80),
});

export const maintenanceUpdateSchema = z.object({
  status: z.enum(["submitted", "under_review", "assigned", "in_progress", "resolved", "rejected"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assigned_to: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment.").max(1500),
  is_internal: z.coerce.boolean().optional(),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(80),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  roll_number: z.string().trim().max(24).optional().or(z.literal("")),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  interests: z.array(z.string().max(40)).max(8).optional(),
});

export const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["student", "faculty", "admin"]),
});
