import type {
  Announcement,
  AppNotification,
  AuditLog,
  Classroom,
  Department,
  ExamSchedule,
  GroupMessage,
  MaintenanceComment,
  MaintenanceHistory,
  MaintenanceRequest,
  MentorGroup,
  MentorGroupMember,
  MessageAttachment,
  Opportunity,
  PrintRequest,
  PrintSettings,
  Profile,
  Subject,
  TimetableCorrection,
  TimetableEntry,
} from "@/types";

/**
 * Local demonstration backend.
 *
 * Demo mode is used when Supabase credentials are not configured. Seed data lives
 * in memory for the lifetime of the server process and resets on restart. It is
 * intentionally labelled as demo mode throughout the UI. The Supabase adapter is
 * the production path: it uses Auth, Postgres + RLS and Storage.
 */

export interface DemoProfile extends Profile {
  password?: string;
}

export interface DemoStore {
  profiles: DemoProfile[];
  departments: Department[];
  announcements: Announcement[];
  announcement_reads: { announcement_id: string; user_id: string; created_at: string }[];
  subjects: Subject[];
  classrooms: Classroom[];
  timetable_entries: TimetableEntry[];
  exams: ExamSchedule[];
  timetable_corrections: TimetableCorrection[];
  print_settings: PrintSettings;
  print_requests: PrintRequest[];
  mentor_groups: MentorGroup[];
  mentor_group_members: MentorGroupMember[];
  group_messages: GroupMessage[];
  message_attachments: MessageAttachment[];
  opportunities: Opportunity[];
  opportunity_bookmarks: { user_id: string; opportunity_id: string; created_at: string }[];
  maintenance_requests: MaintenanceRequest[];
  maintenance_history: MaintenanceHistory[];
  maintenance_comments: MaintenanceComment[];
  notifications: AppNotification[];
  audit_logs: AuditLog[];
}

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "unisync123";

const IDS = {
  student: "11111111-1111-4111-8111-111111111101",
  student2: "11111111-1111-4111-8111-111111111102",
  student3: "11111111-1111-4111-8111-111111111103",
  student4: "11111111-1111-4111-8111-111111111104",
  faculty: "22222222-2222-4222-8222-222222222201",
  faculty2: "22222222-2222-4222-8222-222222222202",
  faculty3: "22222222-2222-4222-8222-222222222203",
  admin: "33333333-3333-4333-8333-333333333301",
  cse: "44444444-4444-4444-8444-444444444401",
  ece: "44444444-4444-4444-8444-444444444402",
  dbms: "55555555-5555-4555-8555-555555555501",
  os: "55555555-5555-4555-8555-555555555502",
  cn: "55555555-5555-4555-8555-555555555503",
  se: "55555555-5555-4555-8555-555555555504",
  cloud: "55555555-5555-4555-8555-555555555505",
  ds: "55555555-5555-4555-8555-555555555506",
  ec: "55555555-5555-4555-8555-555555555507",
  room1: "66666666-6666-4666-8666-666666666601",
  room2: "66666666-6666-4666-8666-666666666602",
  lab1: "66666666-6666-4666-8666-666666666603",
  lab2: "66666666-6666-4666-8666-666666666604",
  blockA: "66666666-6666-4666-8666-666666666605",
  seminar: "66666666-6666-4666-8666-666666666606",
  group1: "77777777-7777-4777-8777-777777777701",
  group2: "77777777-7777-4777-8777-777777777702",
  group3: "77777777-7777-4777-8777-777777777703",
};

const now = () => new Date();
const iso = (date: Date) => date.toISOString();
const shift = (days: number, hours = 0, minutes = 0) => {
  const date = now();
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours, date.getMinutes() + minutes, 0, 0);
  return iso(date);
};
const dateOnly = (dayOffset: number) => {
  const date = now();
  date.setDate(date.getDate() + dayOffset);
  return iso(date).slice(0, 10);
};

function seed(): DemoStore {
  const departments: Department[] = [
    { id: IDS.cse, name: "Computer Science & Engineering", code: "CSE", created_at: shift(-400) },
    { id: IDS.ece, name: "Electronics & Communication", code: "ECE", created_at: shift(-400) },
  ];

  const profiles: DemoProfile[] = [
    {
      id: IDS.student,
      full_name: "Aarav Sharma",
      email: "student@unisync.edu",
      role: "student",
      department_id: IDS.cse,
      department: departments[0],
      roll_number: "CS22B001",
      phone: "+91 98765 43210",
      avatar_url: null,
      interests: ["hackathon", "internship", "workshop"],
      semester: 5,
      password: DEMO_PASSWORD,
      created_at: shift(-180),
      updated_at: shift(-2),
    },
    {
      id: IDS.student2,
      full_name: "Priya Nair",
      email: "priya@unisync.edu",
      role: "student",
      department_id: IDS.cse,
      department: departments[0],
      roll_number: "CS22B014",
      phone: null,
      avatar_url: null,
      interests: ["internship", "placement", "seminar"],
      semester: 5,
      password: DEMO_PASSWORD,
      created_at: shift(-176),
      updated_at: shift(-4),
    },
    {
      id: IDS.student3,
      full_name: "Kabir Verma",
      email: "kabir@unisync.edu",
      role: "student",
      department_id: IDS.ece,
      department: departments[1],
      roll_number: "EC23B022",
      phone: null,
      avatar_url: null,
      interests: ["technical_event", "competition"],
      semester: 3,
      password: DEMO_PASSWORD,
      created_at: shift(-160),
      updated_at: shift(-3),
    },
    {
      id: IDS.student4,
      full_name: "Ananya Rao",
      email: "ananya@unisync.edu",
      role: "student",
      department_id: IDS.cse,
      department: departments[0],
      roll_number: "CS22B007",
      phone: null,
      avatar_url: null,
      interests: ["hackathon", "scholarship", "workshop"],
      semester: 5,
      password: DEMO_PASSWORD,
      created_at: shift(-150),
      updated_at: shift(-5),
    },
    {
      id: IDS.faculty,
      full_name: "Dr. Meera Iyer",
      email: "faculty@unisync.edu",
      role: "faculty",
      department_id: IDS.cse,
      department: departments[0],
      roll_number: null,
      phone: "+91 98450 11223",
      avatar_url: null,
      interests: [],
      semester: null,
      password: DEMO_PASSWORD,
      created_at: shift(-300),
      updated_at: shift(-7),
    },
    {
      id: IDS.faculty2,
      full_name: "Prof. Rohan Desai",
      email: "rohan@unisync.edu",
      role: "faculty",
      department_id: IDS.cse,
      department: departments[0],
      roll_number: null,
      phone: null,
      avatar_url: null,
      interests: [],
      semester: null,
      password: DEMO_PASSWORD,
      created_at: shift(-280),
      updated_at: shift(-7),
    },
    {
      id: IDS.faculty3,
      full_name: "Dr. Sanjay Kulkarni",
      email: "sanjay@unisync.edu",
      role: "faculty",
      department_id: IDS.ece,
      department: departments[1],
      roll_number: null,
      phone: null,
      avatar_url: null,
      interests: [],
      semester: null,
      password: DEMO_PASSWORD,
      created_at: shift(-270),
      updated_at: shift(-7),
    },
    {
      id: IDS.admin,
      full_name: "Kavita Menon",
      email: "admin@unisync.edu",
      role: "admin",
      department_id: null,
      department: null,
      roll_number: null,
      phone: null,
      avatar_url: null,
      interests: [],
      semester: null,
      password: DEMO_PASSWORD,
      created_at: shift(-320),
      updated_at: shift(-1),
    },
  ];

  const subjects: Subject[] = [
    { id: IDS.dbms, name: "Database Management Systems", code: "CS501", department_id: IDS.cse, semester: 5, color: "#2563eb", created_at: shift(-200) },
    { id: IDS.os, name: "Operating Systems", code: "CS502", department_id: IDS.cse, semester: 5, color: "#14b8a6", created_at: shift(-200) },
    { id: IDS.cn, name: "Computer Networks", code: "CS503", department_id: IDS.cse, semester: 5, color: "#f97316", created_at: shift(-200) },
    { id: IDS.se, name: "Software Engineering", code: "CS504", department_id: IDS.cse, semester: 5, color: "#8b5cf6", created_at: shift(-200) },
    { id: IDS.cloud, name: "Cloud Computing", code: "CS505", department_id: IDS.cse, semester: 5, color: "#ec4899", created_at: shift(-200) },
    { id: IDS.ds, name: "Data Structures", code: "CS301", department_id: IDS.cse, semester: 3, color: "#0ea5e9", created_at: shift(-200) },
    { id: IDS.ec, name: "Digital Circuits", code: "EC301", department_id: IDS.ece, semester: 3, color: "#22c55e", created_at: shift(-200) },
  ];

  const classrooms: Classroom[] = [
    { id: IDS.room1, name: "C-101", building: "CSE Block", capacity: 60, created_at: shift(-300) },
    { id: IDS.room2, name: "C-102", building: "CSE Block", capacity: 60, created_at: shift(-300) },
    { id: IDS.lab1, name: "Lab-1", building: "CSE Block", capacity: 40, created_at: shift(-300) },
    { id: IDS.lab2, name: "Lab-2", building: "CSE Block", capacity: 40, created_at: shift(-300) },
    { id: IDS.blockA, name: "A-201", building: "Main Block", capacity: 80, created_at: shift(-300) },
    { id: IDS.seminar, name: "Seminar Hall", building: "Main Block", capacity: 120, created_at: shift(-300) },
  ];

  const subjectById = (id: string) => subjects.find((subject) => subject.id === id) ?? null;
  const roomById = (id: string) => classrooms.find((room) => room.id === id) ?? null;
  const facultyById = (id: string) => profiles.find((profile) => profile.id === id) ?? null;

  const entry = (
    id: string,
    subject_id: string,
    faculty_id: string,
    classroom_id: string,
    day_of_week: number,
    start_time: string,
    end_time: string,
    section = "A",
  ): TimetableEntry => ({
    id,
    subject_id,
    faculty_id,
    classroom_id,
    day_of_week,
    start_time,
    end_time,
    semester: subjectById(subject_id)?.semester ?? 5,
    section,
    academic_year: "2026-27",
    published: true,
    created_at: shift(-60),
    subject: subjectById(subject_id),
    faculty: facultyById(faculty_id),
    classroom: roomById(classroom_id),
  });

  const sc = "88888888-8888-4888-8888-88888888";
  const timetable_entries: TimetableEntry[] = [
    entry(`${sc}0001`, IDS.dbms, IDS.faculty, IDS.room1, 1, "09:00", "10:00"),
    entry(`${sc}0002`, IDS.os, IDS.faculty, IDS.room1, 1, "10:15", "11:15"),
    entry(`${sc}0003`, IDS.cn, IDS.faculty2, IDS.room2, 1, "11:30", "12:30"),
    entry(`${sc}0004`, IDS.se, IDS.faculty2, IDS.room2, 1, "14:00", "15:00"),
    entry(`${sc}0005`, IDS.dbms, IDS.faculty, IDS.lab1, 1, "15:15", "17:15"),
    entry(`${sc}0006`, IDS.dbms, IDS.faculty, IDS.room1, 2, "09:00", "10:00"),
    entry(`${sc}0007`, IDS.cloud, IDS.faculty2, IDS.seminar, 2, "10:15", "11:15"),
    entry(`${sc}0008`, IDS.cn, IDS.faculty2, IDS.room2, 2, "11:30", "12:30"),
    entry(`${sc}0009`, IDS.os, IDS.faculty, IDS.lab2, 2, "14:00", "16:00"),
    entry(`${sc}0010`, IDS.se, IDS.faculty2, IDS.room1, 3, "09:00", "10:00"),
    entry(`${sc}0011`, IDS.cn, IDS.faculty2, IDS.room2, 3, "10:15", "11:15"),
    entry(`${sc}0012`, IDS.dbms, IDS.faculty, IDS.room1, 3, "11:30", "12:30"),
    entry(`${sc}0013`, IDS.cloud, IDS.faculty2, IDS.seminar, 4, "09:00", "10:00"),
    entry(`${sc}0014`, IDS.os, IDS.faculty, IDS.room1, 4, "10:15", "11:15"),
    entry(`${sc}0015`, IDS.se, IDS.faculty2, IDS.lab1, 4, "14:00", "16:00"),
    entry(`${sc}0016`, IDS.dbms, IDS.faculty, IDS.lab1, 5, "09:00", "11:00"),
    entry(`${sc}0017`, IDS.cloud, IDS.faculty2, IDS.room2, 5, "11:30", "12:30"),
    entry(`${sc}0018`, IDS.ds, IDS.faculty3, IDS.blockA, 3, "09:00", "10:00", "ECE-A"),
    entry(`${sc}0019`, IDS.ec, IDS.faculty3, IDS.blockA, 4, "11:30", "12:30", "ECE-A"),
  ];

  const exams: ExamSchedule[] = [
    { id: `${sc}1001`, subject_id: IDS.dbms, exam_date: dateOnly(5), start_time: "09:30", end_time: "11:30", room: "A-201", exam_type: "midterm", semester: 5, created_at: shift(-20), subject: subjectById(IDS.dbms) },
    { id: `${sc}1002`, subject_id: IDS.os, exam_date: dateOnly(8), start_time: "09:30", end_time: "11:30", room: "C-101", exam_type: "midterm", semester: 5, created_at: shift(-20), subject: subjectById(IDS.os) },
    { id: `${sc}1003`, subject_id: IDS.cn, exam_date: dateOnly(12), start_time: "14:00", end_time: "16:00", room: "Seminar Hall", exam_type: "end_semester", semester: 5, created_at: shift(-20), subject: subjectById(IDS.cn) },
  ];

  const print_settings: PrintSettings = {
    id: "settings",
    bw_single: 2,
    bw_double: 3,
    color_single: 5,
    color_double: 8,
    avg_processing_minutes: 4,
    max_pages_per_job: 100,
    printer_mode: "simulated",
    updated_at: shift(-30),
  };

  const print_requests: PrintRequest[] = [
    {
      id: `${sc}2001`,
      request_number: "PP-1042",
      student_id: IDS.student,
      student: profiles[0],
      document_name: "DBMS Unit 3 — Normalisation Notes",
      file_path: null,
      file_size: 684032,
      pages: 12,
      page_range: "1-12",
      copies: 1,
      color_mode: "bw",
      sides: "double",
      status: "queued",
      estimated_cost: 36,
      payment_status: "not_required",
      payment_method: "none",
      priority: "normal",
      print_mode: "simulated",
      notes: "Need before the 2 PM lab.",
      created_at: shift(0, 0, -22),
      updated_at: shift(0, 0, -18),
    },
    {
      id: `${sc}2002`,
      request_number: "PP-1041",
      student_id: IDS.student,
      student: profiles[0],
      document_name: "Aarav Sharma — Resume 2026",
      file_path: null,
      file_size: 184320,
      pages: 2,
      page_range: "1-2",
      copies: 3,
      color_mode: "bw",
      sides: "single",
      status: "ready",
      estimated_cost: 12,
      payment_status: "not_required",
      payment_method: "none",
      priority: "normal",
      print_mode: "simulated",
      notes: null,
      created_at: shift(0, -2, -10),
      updated_at: shift(0, -1, -30),
    },
    {
      id: `${sc}2003`,
      request_number: "PP-1038",
      student_id: IDS.student,
      student: profiles[0],
      document_name: "OS Lab Record — Sem 5",
      file_path: null,
      file_size: 2411724,
      pages: 30,
      page_range: "1-30",
      copies: 1,
      color_mode: "bw",
      sides: "double",
      status: "completed",
      estimated_cost: 90,
      payment_status: "not_required",
      payment_method: "none",
      priority: "normal",
      print_mode: "simulated",
      notes: null,
      created_at: shift(-1, -3),
      updated_at: shift(-1, -1),
    },
    {
      id: `${sc}2004`,
      request_number: "PP-1035",
      student_id: IDS.student,
      student: profiles[0],
      document_name: "Workshop Certificate",
      file_path: null,
      file_size: 92160,
      pages: 1,
      page_range: "1",
      copies: 1,
      color_mode: "color",
      sides: "single",
      status: "cancelled",
      estimated_cost: 5,
      payment_status: "not_required",
      payment_method: "none",
      priority: "normal",
      print_mode: "simulated",
      notes: null,
      created_at: shift(-2, -5),
      updated_at: shift(-2, -4),
    },
    {
      id: `${sc}2005`,
      request_number: "PP-1043",
      student_id: IDS.student2,
      student: profiles[1],
      document_name: "Placement Portfolio",
      file_path: null,
      file_size: 1310720,
      pages: 8,
      page_range: "1-8",
      copies: 2,
      color_mode: "color",
      sides: "single",
      status: "queued",
      estimated_cost: 80,
      payment_status: "unpaid",
      payment_method: "desk",
      priority: "normal",
      print_mode: "simulated",
      notes: null,
      created_at: shift(0, 0, -12),
      updated_at: shift(0, 0, -12),
    },
    {
      id: `${sc}2006`,
      request_number: "PP-1040",
      student_id: IDS.student3,
      student: profiles[2],
      document_name: "Digital Circuits Assignment 2",
      file_path: null,
      file_size: 512000,
      pages: 6,
      page_range: "1-6",
      copies: 1,
      color_mode: "bw",
      sides: "single",
      status: "processing",
      estimated_cost: 12,
      payment_status: "not_required",
      payment_method: "none",
      priority: "urgent",
      print_mode: "simulated",
      notes: null,
      created_at: shift(0, 0, -30),
      updated_at: shift(0, 0, -6),
    },
  ];

  const mentor_groups: MentorGroup[] = [
    {
      id: IDS.group1,
      name: "DBMS Doubt Clearing",
      description: "Weekly doubt-clearing group for CS501. Post questions before Friday labs.",
      mentor_id: IDS.faculty,
      department_id: IDS.cse,
      mentor: profiles[4],
      created_at: shift(-45),
    },
    {
      id: IDS.group2,
      name: "Placement Prep Circle",
      description: "Aptitude, DSA and mock interviews for the upcoming placement season.",
      mentor_id: IDS.faculty2,
      department_id: IDS.cse,
      mentor: profiles[5],
      created_at: shift(-40),
    },
    {
      id: IDS.group3,
      name: "Semester 5 Project Squad",
      description: "Coordination space for the capstone project teams.",
      mentor_id: IDS.faculty,
      department_id: IDS.cse,
      mentor: profiles[4],
      created_at: shift(-25),
    },
  ];

  const mentor_group_members: MentorGroupMember[] = [
    { group_id: IDS.group1, user_id: IDS.faculty, member_role: "mentor", joined_at: shift(-45), last_read_at: shift(0, -1), profile: profiles[4] },
    { group_id: IDS.group1, user_id: IDS.student, member_role: "student", joined_at: shift(-44), last_read_at: shift(-1), profile: profiles[0] },
    { group_id: IDS.group1, user_id: IDS.student2, member_role: "student", joined_at: shift(-44), last_read_at: shift(0, -3), profile: profiles[1] },
    { group_id: IDS.group1, user_id: IDS.student4, member_role: "student", joined_at: shift(-43), last_read_at: shift(0, -1), profile: profiles[3] },
    { group_id: IDS.group2, user_id: IDS.faculty2, member_role: "mentor", joined_at: shift(-40), last_read_at: shift(0, -2), profile: profiles[5] },
    { group_id: IDS.group2, user_id: IDS.student, member_role: "student", joined_at: shift(-39), last_read_at: shift(0, -30), profile: profiles[0] },
    { group_id: IDS.group2, user_id: IDS.student2, member_role: "student", joined_at: shift(-39), last_read_at: shift(0, -1), profile: profiles[1] },
    { group_id: IDS.group3, user_id: IDS.faculty, member_role: "mentor", joined_at: shift(-25), last_read_at: shift(0, -1), profile: profiles[4] },
    { group_id: IDS.group3, user_id: IDS.student, member_role: "student", joined_at: shift(-24), last_read_at: shift(0, -20), profile: profiles[0] },
    { group_id: IDS.group3, user_id: IDS.student4, member_role: "student", joined_at: shift(-24), last_read_at: shift(0, -2), profile: profiles[3] },
  ];

  const msgs = "99999999-9999-4999-8999-99999999";
  const group_messages: GroupMessage[] = [
    { id: `${msgs}0001`, group_id: IDS.group1, sender_id: IDS.faculty, body: "Reminder: the normalisation assignment is due Friday. Bring your ER diagrams to the lab.", created_at: shift(-1, -3), sender: { id: IDS.faculty, full_name: "Dr. Meera Iyer", role: "faculty" } },
    { id: `${msgs}0002`, group_id: IDS.group1, sender_id: IDS.student2, body: "Ma'am, can we use the 3NF decomposition from Wednesday's lecture for question 4?", created_at: shift(-1, -2), sender: { id: IDS.student2, full_name: "Priya Nair", role: "student" } },
    { id: `${msgs}0003`, group_id: IDS.group1, sender_id: IDS.faculty, body: "Yes. Show both the original and decomposed schemas so the steps are clear.", created_at: shift(0, -4), sender: { id: IDS.faculty, full_name: "Dr. Meera Iyer", role: "faculty" } },
    { id: `${msgs}0004`, group_id: IDS.group1, sender_id: IDS.student4, body: "Sharing my notes from today's class. Chapter 7 starts at page 12.", created_at: shift(0, -2), sender: { id: IDS.student4, full_name: "Ananya Rao", role: "student" } },
    { id: `${msgs}0005`, group_id: IDS.group1, sender_id: IDS.student, body: "Thanks Ananya! I had one question about BCNF vs 3NF — can we discuss it after the lab?", created_at: shift(0, -1), sender: { id: IDS.student, full_name: "Aarav Sharma", role: "student" } },
    { id: `${msgs}0006`, group_id: IDS.group2, sender_id: IDS.faculty2, body: "Mock aptitude test this Saturday at 10 AM in Lab-1. Attempt the full 60 minutes without breaks.", created_at: shift(0, -5), sender: { id: IDS.faculty2, full_name: "Prof. Rohan Desai", role: "faculty" } },
    { id: `${msgs}0007`, group_id: IDS.group2, sender_id: IDS.student, body: "Count me in. Should we bring our own laptops?", created_at: shift(0, -4), sender: { id: IDS.student, full_name: "Aarav Sharma", role: "student" } },
    { id: `${msgs}0008`, group_id: IDS.group2, sender_id: IDS.faculty2, body: "Yes, laptops please. I'll share the test link at the start.", created_at: shift(0, -3), sender: { id: IDS.faculty2, full_name: "Prof. Rohan Desai", role: "faculty" } },
    { id: `${msgs}0009`, group_id: IDS.group3, sender_id: IDS.student4, body: "Team 3 has finalised the healthcare dashboard idea. Uploading the abstract tonight.", created_at: shift(0, -5), sender: { id: IDS.student4, full_name: "Ananya Rao", role: "student" } },
    { id: `${msgs}0010`, group_id: IDS.group3, sender_id: IDS.faculty, body: "Good. Keep the scope small and include testable acceptance criteria.", created_at: shift(0, -3), sender: { id: IDS.faculty, full_name: "Dr. Meera Iyer", role: "faculty" } },
  ];

  const opportunities: Opportunity[] = [
    {
      id: `${sc}3001`, title: "Smart India Hackathon 2026", organization: "Ministry of Education, Govt. of India",
      category: "hackathon", description: "A nationwide 36-hour innovation challenge across software and hardware problem statements. Teams of up to six students build a working prototype and pitch to a jury.",
      eligibility: "All undergraduate students. Teams of 4–6 with at least one female member.", location: "Bengaluru (Grand Finale)", mode: "offline",
      deadline: shift(18), event_start: shift(32), event_end: shift(34), apply_url: "https://www.sih.gov.in/", tags: ["innovation", "team", "prototype"],
      posted_by: IDS.faculty2, poster: { id: IDS.faculty2, full_name: "Prof. Rohan Desai" }, created_at: shift(-3),
    },
    {
      id: `${sc}3002`, title: "Frontend Engineering Intern", organization: "Zoho Corporation",
      category: "internship", description: "Six-month internship on the Zoho Creator frontend team. Work with React and TypeScript on production UI used by thousands of businesses.",
      eligibility: "Pre-final and final year CSE/IT students with a strong React portfolio.", location: "Chennai", mode: "hybrid",
      deadline: shift(9), event_start: shift(20), event_end: null, apply_url: "https://www.zoho.com/careers/", tags: ["react", "typescript", "frontend"],
      posted_by: IDS.faculty, poster: { id: IDS.faculty, full_name: "Dr. Meera Iyer" }, created_at: shift(-1),
    },
    {
      id: `${sc}3003`, title: "Cloud Fundamentals Workshop", organization: "AWS Academy × UniSync",
      category: "workshop", description: "Hands-on workshop covering IAM, S3, Lambda and cost-safe deployments. Bring a laptop with an SSH client.",
      eligibility: "Open to all students; basic networking knowledge recommended.", location: "Seminar Hall, Main Block", mode: "offline",
      deadline: shift(4), event_start: shift(6), event_end: shift(6), apply_url: "https://aws.amazon.com/training/", tags: ["cloud", "aws", "hands-on"],
      posted_by: IDS.faculty2, poster: { id: IDS.faculty2, full_name: "Prof. Rohan Desai" }, created_at: shift(-2),
    },
    {
      id: `${sc}3004`, title: "Graduate Software Engineer — 2027", organization: "Microsoft India",
      category: "placement", description: "Campus hiring for full-time software engineering roles. Online assessment followed by technical interviews.",
      eligibility: "Final year B.E./B.Tech students with 7.0+ CGPA and no active backlogs.", location: "Hyderabad / Noida", mode: "hybrid",
      deadline: shift(14), event_start: shift(24), event_end: null, apply_url: "https://careers.microsoft.com/", tags: ["full-time", "dsa", "campus"],
      posted_by: IDS.admin, poster: { id: IDS.admin, full_name: "Kavita Menon" }, created_at: shift(-5),
    },
    {
      id: `${sc}3005`, title: "Reliance Foundation Undergraduate Scholarship", organization: "Reliance Foundation",
      category: "scholarship", description: "Merit-cum-means scholarship covering tuition support and mentoring for undergraduate students.",
      eligibility: "First-year to final-year undergraduates with family income below ₹15 lakh.", location: "India", mode: "online",
      deadline: shift(26), event_start: null, event_end: null, apply_url: "https://www.reliancefoundation.org/scholarships", tags: ["scholarship", "financial aid"],
      posted_by: IDS.faculty, poster: { id: IDS.faculty, full_name: "Dr. Meera Iyer" }, created_at: shift(-7),
    },
    {
      id: `${sc}3006`, title: "IEEE Technical Paper Competition", organization: "IEEE Student Branch",
      category: "competition", description: "Present original research or a technical review paper. Shortlisted teams present at the regional congress.",
      eligibility: "Teams of up to 3 students. Paper must be original and unpublished.", location: "Pune", mode: "offline",
      deadline: shift(11), event_start: shift(28), event_end: shift(29), apply_url: "https://www.ieee.org/", tags: ["research", "paper", "ieee"],
      posted_by: IDS.faculty3, poster: { id: IDS.faculty3, full_name: "Dr. Sanjay Kulkarni" }, created_at: shift(-4),
    },
    {
      id: `${sc}3007`, title: "AI for Bharat Seminar", organization: "IIT Bombay — AI Centre",
      category: "seminar", description: "A half-day seminar on applied AI for public infrastructure, with demos from research labs.",
      eligibility: "Open to all students and faculty. Registration is free.", location: "Online", mode: "online",
      deadline: shift(7), event_start: shift(13), event_end: shift(13), apply_url: "https://www.iitb.ac.in/", tags: ["ai", "seminar", "research"],
      posted_by: IDS.admin, poster: { id: IDS.admin, full_name: "Kavita Menon" }, created_at: shift(-1),
    },
    {
      id: `${sc}3008`, title: "CodeSprint Campus Challenge", organization: "UniSync Coding Club",
      category: "technical_event", description: "A three-round competitive programming sprint with prizes for the top ten coders.",
      eligibility: "All UG students. Individual participation.", location: "Lab-1 & Lab-2", mode: "offline",
      deadline: shift(3), event_start: shift(10), event_end: shift(10), apply_url: "https://codeforces.com/", tags: ["competitive programming", "dsa"],
      posted_by: IDS.faculty2, poster: { id: IDS.faculty2, full_name: "Prof. Rohan Desai" }, created_at: shift(0, -6),
    },
    {
      id: `${sc}3009`, title: "Design Thinking Bootcamp", organization: "UniSync Innovation Cell",
      category: "workshop", description: "Two-day bootcamp on customer discovery, prototyping and pitch storytelling.",
      eligibility: "Open to all departments. 40 seats.", location: "Innovation Lab", mode: "offline",
      deadline: shift(-2), event_start: shift(5), event_end: shift(6), apply_url: "https://www.designcouncil.org.uk/", tags: ["design", "startup"],
      posted_by: IDS.admin, poster: { id: IDS.admin, full_name: "Kavita Menon" }, created_at: shift(-9),
    },
    {
      id: `${sc}3010`, title: "Backend Developer Intern", organization: "Freshworks",
      category: "internship", description: "Work on Go and PostgreSQL services in the platform team. Mentored internship with a PPO track.",
      eligibility: "Third year CSE/IT students. Strong fundamentals in DBMS and OS.", location: "Chennai", mode: "offline",
      deadline: shift(21), event_start: shift(35), event_end: null, apply_url: "https://www.freshworks.com/company/careers/", tags: ["backend", "go", "postgres"],
      posted_by: IDS.faculty, poster: { id: IDS.faculty, full_name: "Dr. Meera Iyer" }, created_at: shift(-2),
    },
  ];

  const maintenance_requests: MaintenanceRequest[] = [
    {
      id: `${sc}4001`, ticket_number: "FX-2081", student_id: IDS.student, student: profiles[0],
      title: "Projector not powering on in C-102", description: "The ceiling projector in C-102 does not power on. The indicator light stays red and the remote has no effect. This is blocking the Friday DBMS presentation.",
      category: "Broken classroom equipment", building: "CSE Block", room: "C-102", photo_path: null,
      priority: "high", status: "in_progress", assigned_to: IDS.faculty, resolution_note: null, resolution_photo_path: null,
      created_at: shift(-2), updated_at: shift(0, -3), resolved_at: null,
    },
    {
      id: `${sc}4002`, ticket_number: "FX-2085", student_id: IDS.student, student: profiles[0],
      title: "Water leakage near first-floor washroom", description: "Water is seeping from the ceiling outside the Main Block washroom and pooling near the stairs.",
      category: "Water leakage", building: "Main Block", room: "1st floor, near washroom", photo_path: null,
      priority: "urgent", status: "submitted", assigned_to: null, resolution_note: null, resolution_photo_path: null,
      created_at: shift(0, -4), updated_at: shift(0, -4), resolved_at: null,
    },
    {
      id: `${sc}4003`, ticket_number: "FX-2072", student_id: IDS.student, student: profiles[0],
      title: "Wi-Fi keeps disconnecting in the library", description: "The library Wi-Fi drops every few minutes on the second floor. Other devices are affected too.",
      category: "Internet problem", building: "Library", room: "Second floor", photo_path: null,
      priority: "medium", status: "resolved", assigned_to: IDS.faculty2, resolution_note: "Access point replaced and channel re-balanced. Please report again if the drops continue.",
      resolution_photo_path: null, created_at: shift(-6), updated_at: shift(-3), resolved_at: shift(-3),
    },
    {
      id: `${sc}4004`, ticket_number: "FX-2086", student_id: IDS.student2, student: profiles[1],
      title: "Flickering tube light in C-101", description: "The second tube light near the window flickers constantly and makes a buzzing sound.",
      category: "Electrical issue", building: "CSE Block", room: "C-101", photo_path: null,
      priority: "low", status: "under_review", assigned_to: null, resolution_note: null, resolution_photo_path: null,
      created_at: shift(-1), updated_at: shift(0, -6), resolved_at: null,
    },
    {
      id: `${sc}4005`, ticket_number: "FX-2087", student_id: IDS.student3, student: profiles[2],
      title: "Oscilloscope in Electronics Lab not calibrating", description: "Channel 2 of the Tektronix oscilloscope shows a constant offset and will not calibrate. Lab practicals are affected.",
      category: "Laboratory equipment", building: "Science Block", room: "Electronics Lab", photo_path: null,
      priority: "high", status: "assigned", assigned_to: IDS.faculty3, resolution_note: null, resolution_photo_path: null,
      created_at: shift(-4), updated_at: shift(-1), resolved_at: null,
    },
  ];

  const maintenance_history: MaintenanceHistory[] = [
    { id: `${sc}5001`, request_id: `${sc}4001`, status: "submitted", note: "Complaint submitted by student.", changed_by: IDS.student, actor: profiles[0], created_at: shift(-2) },
    { id: `${sc}5002`, request_id: `${sc}4001`, status: "under_review", note: "Facilities team is checking the projector inventory.", changed_by: IDS.admin, actor: profiles[7], created_at: shift(-1, -6) },
    { id: `${sc}5003`, request_id: `${sc}4001`, status: "assigned", note: "Assigned to Ravi Kumar (AV maintenance).", changed_by: IDS.admin, actor: profiles[7], created_at: shift(-1, -2) },
    { id: `${sc}5004`, request_id: `${sc}4001`, status: "in_progress", note: "Replacement lamp ordered. Temporary projector being installed.", changed_by: IDS.admin, actor: profiles[7], created_at: shift(0, -3) },
    { id: `${sc}5005`, request_id: `${sc}4002`, status: "submitted", note: "Complaint submitted by student.", changed_by: IDS.student, actor: profiles[0], created_at: shift(0, -4) },
    { id: `${sc}5006`, request_id: `${sc}4003`, status: "submitted", note: "Complaint submitted by student.", changed_by: IDS.student, actor: profiles[0], created_at: shift(-6) },
    { id: `${sc}5007`, request_id: `${sc}4003`, status: "assigned", note: "Assigned to Imran Shaikh (Network team).", changed_by: IDS.admin, actor: profiles[7], created_at: shift(-5) },
    { id: `${sc}5008`, request_id: `${sc}4003`, status: "resolved", note: "Access point replaced and channel re-balanced.", changed_by: IDS.admin, actor: profiles[7], created_at: shift(-3) },
    { id: `${sc}5009`, request_id: `${sc}4004`, status: "submitted", note: "Complaint submitted by student.", changed_by: IDS.student2, actor: profiles[1], created_at: shift(-1) },
    { id: `${sc}5010`, request_id: `${sc}4004`, status: "under_review", note: "Electrical team notified.", changed_by: IDS.admin, actor: profiles[7], created_at: shift(0, -6) },
    { id: `${sc}5011`, request_id: `${sc}4005`, status: "submitted", note: "Complaint submitted by student.", changed_by: IDS.student3, actor: profiles[2], created_at: shift(-4) },
    { id: `${sc}5012`, request_id: `${sc}4005`, status: "assigned", note: "Assigned to Sunita Patil (Lab maintenance).", changed_by: IDS.admin, actor: profiles[7], created_at: shift(-1) },
  ];

  const maintenance_comments: MaintenanceComment[] = [
    { id: `${sc}6001`, request_id: `${sc}4001`, author_id: IDS.admin, body: "Temporary projector will be available by tomorrow morning.", is_internal: false, created_at: shift(0, -3), author: profiles[7] },
    { id: `${sc}6002`, request_id: `${sc}4003`, author_id: IDS.student, body: "Wi-Fi seems stable now — thank you!", is_internal: false, created_at: shift(-3, -1), author: profiles[0] },
  ];

  const announcements: Announcement[] = [
    {
      id: `${sc}7001`, title: "Mid-semester examination timetable published", body: "The mid-semester examination timetable for all departments is now available in TimeGrid. Examinations begin next week. Students must carry their college ID and hall ticket to every exam.",
      category: "exam", audience: "all", author_id: IDS.admin, author: profiles[7], published_at: shift(0, -3), created_at: shift(0, -3), attachment_path: null, attachment_name: null,
    },
    {
      id: `${sc}7002`, title: "Library extends weekend hours", body: "The central library will remain open until 9 PM on Saturdays and Sundays through the examination period. Reading rooms on the second floor are available for group study.",
      category: "general", audience: "all", author_id: IDS.admin, author: profiles[7], published_at: shift(-1, -2), created_at: shift(-1, -2), attachment_path: null, attachment_name: null,
    },
    {
      id: `${sc}7003`, title: "DBMS lab rescheduled to Friday", body: "This week's CS501 database lab has moved from Thursday 2 PM to Friday 9 AM in Lab-1. Please complete the normalisation assignment before the session.",
      category: "academic", audience: "students", author_id: IDS.faculty, author: profiles[4], published_at: shift(-1, -5), created_at: shift(-1, -5), attachment_path: null, attachment_name: null,
    },
    {
      id: `${sc}7004`, title: "Scholarship applications close in 10 days", body: "The Reliance Foundation undergraduate scholarship applications close in 10 days. Eligible students should review the opportunity in Opportune and apply before the deadline.",
      category: "general", audience: "students", author_id: IDS.faculty, author: profiles[4], published_at: shift(-2), created_at: shift(-2), attachment_path: null, attachment_name: null,
    },
  ];

  const notifications: AppNotification[] = [
    { id: `${sc}8001`, user_id: IDS.student, title: "Print job ready for collection", body: "PP-1041 · Aarav Sharma — Resume 2026 is waiting at the PrintPulse desk.", link: `/printpulse/${sc}2002`, type: "print", is_read: false, created_at: shift(0, -1, -30) },
    { id: `${sc}8002`, user_id: IDS.student, title: "New message in DBMS Doubt Clearing", body: "Ananya Rao shared notes from today's class.", link: `/mentorloop/${IDS.group1}`, type: "message", is_read: false, created_at: shift(0, -2) },
    { id: `${sc}8003`, user_id: IDS.student, title: "Mid-sem exam timetable published", body: "Check your examination dates in TimeGrid.", link: "/timegrid", type: "announcement", is_read: false, created_at: shift(0, -3) },
    { id: `${sc}8004`, user_id: IDS.student, title: "Complaint FX-2081 updated", body: "Status changed to In Progress. A temporary projector is being installed.", link: `/fixora/${sc}4001`, type: "maintenance", is_read: true, created_at: shift(0, -3) },
    { id: `${sc}8005`, user_id: IDS.student, title: "Deadline approaching: Frontend internship", body: "Zoho's frontend internship closes in 9 days.", link: `/opportune/${sc}3002`, type: "opportunity", is_read: true, created_at: shift(-1) },
    { id: `${sc}8006`, user_id: IDS.faculty, title: "New question in DBMS Doubt Clearing", body: "Aarav Sharma asked about BCNF vs 3NF.", link: `/mentorloop/${IDS.group1}`, type: "message", is_read: false, created_at: shift(0, -1) },
    { id: `${sc}8007`, user_id: IDS.faculty, title: "Maintenance issue assigned to your department", body: "FX-2081 · Projector not powering on in C-102.", link: `/fixora/${sc}4001`, type: "maintenance", is_read: false, created_at: shift(0, -3) },
    { id: `${sc}8008`, user_id: IDS.admin, title: "5 print requests waiting in queue", body: "PrintPulse has jobs awaiting processing.", link: "/admin/printpulse", type: "print", is_read: false, created_at: shift(0, -2) },
    { id: `${sc}8009`, user_id: IDS.admin, title: "Urgent complaint: water leakage", body: "FX-2085 · Main Block first floor.", link: `/fixora/${sc}4002`, type: "maintenance", is_read: false, created_at: shift(0, -4) },
  ];

  return {
    profiles,
    departments,
    announcements,
    announcement_reads: [{ announcement_id: `${sc}7002`, user_id: IDS.student, created_at: shift(-1) }],
    subjects,
    classrooms,
    timetable_entries,
    exams,
    timetable_corrections: [
      {
        id: `${sc}1101`,
        entry_id: `${sc}0011`,
        requested_by: IDS.faculty2,
        reason: "Computer Networks on Wednesday clashes with the department faculty meeting. Requesting a move to 12:30.",
        status: "pending",
        admin_note: null,
        created_at: shift(-1),
      },
    ],
    print_settings,
    print_requests,
    mentor_groups,
    mentor_group_members,
    group_messages,
    message_attachments: [],
    opportunities,
    opportunity_bookmarks: [
      { user_id: IDS.student, opportunity_id: `${sc}3001`, created_at: shift(-2) },
      { user_id: IDS.student, opportunity_id: `${sc}3002`, created_at: shift(-1) },
    ],
    maintenance_requests,
    maintenance_history,
    maintenance_comments,
    notifications,
    audit_logs: [
      { id: `${sc}9001`, actor_id: IDS.admin, action: "maintenance.assigned", entity: "maintenance_requests", entity_id: `${sc}4001`, details: { assigned_to: "Ravi Kumar" }, created_at: shift(-1, -2) },
      { id: `${sc}9002`, actor_id: IDS.admin, action: "announcement.published", entity: "announcements", entity_id: `${sc}7001`, details: { title: "Mid-semester examination timetable published" }, created_at: shift(0, -3) },
    ],
  };
}

const globalForDemo = globalThis as unknown as { __unisyncDemoStore?: DemoStore };

export function getDemoStore(): DemoStore {
  if (!globalForDemo.__unisyncDemoStore) {
    globalForDemo.__unisyncDemoStore = seed();
  }
  return globalForDemo.__unisyncDemoStore;
}

export function resetDemoStore() {
  globalForDemo.__unisyncDemoStore = seed();
}

export const DEMO_IDS = IDS;

export function demoProfileById(id: string | undefined | null) {
  if (!id) return null;
  return getDemoStore().profiles.find((profile) => profile.id === id) ?? null;
}

export function demoProfileByEmail(email: string) {
  const store = getDemoStore();
  return store.profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase()) ?? null;
}
