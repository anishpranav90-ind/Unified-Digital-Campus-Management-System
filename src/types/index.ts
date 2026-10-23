export type Role = "student" | "faculty" | "admin";

export type PrintStatus =
  | "submitted"
  | "queued"
  | "processing"
  | "ready"
  | "completed"
  | "cancelled"
  | "failed";

export type MaintenanceStatus =
  | "submitted"
  | "under_review"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "rejected";

export type OpportunityCategory =
  | "hackathon"
  | "internship"
  | "workshop"
  | "technical_event"
  | "competition"
  | "seminar"
  | "placement"
  | "scholarship";

export interface Department {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department_id: string | null;
  department?: Department | null;
  roll_number: string | null;
  phone: string | null;
  avatar_url: string | null;
  interests: string[];
  semester: number | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: "general" | "academic" | "exam" | "event" | "urgent";
  audience: "all" | "students" | "faculty" | "admins";
  author_id: string;
  author?: Pick<Profile, "id" | "full_name" | "role"> | null;
  attachment_path: string | null;
  attachment_name: string | null;
  published_at: string;
  created_at: string;
  is_read?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  department_id: string | null;
  semester: number;
  color: string;
  created_at: string;
}

export interface Classroom {
  id: string;
  name: string;
  building: string;
  capacity: number;
  created_at: string;
}

export interface TimetableEntry {
  id: string;
  subject_id: string;
  faculty_id: string;
  classroom_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  semester: number;
  section: string;
  academic_year: string;
  published: boolean;
  created_at: string;
  subject?: Subject | null;
  faculty?: Pick<Profile, "id" | "full_name"> | null;
  classroom?: Classroom | null;
}

export interface ExamSchedule {
  id: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
  exam_type: "midterm" | "end_semester" | "practical" | "viva";
  semester: number;
  created_at: string;
  subject?: Subject | null;
}

export interface PrintSettings {
  id: string;
  bw_single: number;
  bw_double: number;
  color_single: number;
  color_double: number;
  avg_processing_minutes: number;
  max_pages_per_job: number;
  printer_mode: "simulated" | "cups";
  updated_at: string;
}

export interface PrintRequest {
  id: string;
  request_number: string;
  student_id: string;
  student?: Pick<Profile, "id" | "full_name" | "email" | "roll_number"> | null;
  document_name: string;
  file_path: string | null;
  file_size: number | null;
  pages: number;
  page_range: string | null;
  copies: number;
  color_mode: "bw" | "color";
  sides: "single" | "double";
  status: PrintStatus;
  estimated_cost: number;
  payment_status: "unpaid" | "paid" | "not_required" | "refunded";
  payment_method: string;
  priority: "normal" | "urgent";
  print_mode: "simulated" | "cups";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentorGroup {
  id: string;
  name: string;
  description: string;
  mentor_id: string;
  department_id: string | null;
  mentor?: Pick<Profile, "id" | "full_name" | "email"> | null;
  created_at: string;
  member_count?: number;
  unread_count?: number;
  last_message?: string | null;
  last_message_at?: string | null;
}

export interface MentorGroupMember {
  group_id: string;
  user_id: string;
  member_role: "mentor" | "student" | "assistant";
  joined_at: string;
  last_read_at: string | null;
  profile?: Pick<Profile, "id" | "full_name" | "email" | "role"> | null;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: Pick<Profile, "id" | "full_name" | "role"> | null;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  category: OpportunityCategory;
  description: string;
  eligibility: string | null;
  location: string | null;
  mode: "online" | "offline" | "hybrid" | null;
  deadline: string;
  event_start: string | null;
  event_end: string | null;
  apply_url: string;
  tags: string[];
  posted_by: string;
  poster?: Pick<Profile, "id" | "full_name"> | null;
  created_at: string;
  is_bookmarked?: boolean;
}

export interface MaintenanceRequest {
  id: string;
  ticket_number: string;
  student_id: string;
  student?: Pick<Profile, "id" | "full_name" | "email"> | null;
  title: string;
  description: string;
  category: string;
  building: string;
  room: string;
  photo_path: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: MaintenanceStatus;
  assigned_to: string | null;
  resolution_note: string | null;
  resolution_photo_path: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface MaintenanceHistory {
  id: string;
  request_id: string;
  status: MaintenanceStatus;
  note: string | null;
  changed_by: string | null;
  actor?: Pick<Profile, "id" | "full_name"> | null;
  created_at: string;
}

export interface MaintenanceComment {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  type:
    | "announcement"
    | "timetable"
    | "print"
    | "message"
    | "opportunity"
    | "maintenance"
    | "system";
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface QueueInfo {
  pending: number;
  processing: number;
  estimated_wait_minutes: number;
  position: number | null;
}
