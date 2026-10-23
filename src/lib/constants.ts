export const APP_NAME = "UniSync";
export const APP_TAGLINE = "One Campus. Everything in Sync.";

export const MODULES = [
  {
    key: "printpulse",
    name: "PrintPulse",
    tagline: "Smart Printout Queue",
    description: "Upload, price and queue print jobs with live position tracking.",
    href: "/printpulse",
    icon: "Printer",
    accent: "orange",
  },
  {
    key: "timegrid",
    name: "TimeGrid",
    tagline: "Timetable Hub",
    description: "One source of truth for classes, rooms, faculty and exams.",
    href: "/timegrid",
    icon: "CalendarDays",
    accent: "blue",
  },
  {
    key: "mentorloop",
    name: "MentorLoop",
    tagline: "Mentor Communication",
    description: "Purpose-built mentor groups and academic conversations.",
    href: "/mentorloop",
    icon: "MessagesSquare",
    accent: "teal",
  },
  {
    key: "opportune",
    name: "Opportune",
    tagline: "Events & Opportunities",
    description: "Hackathons, internships and deadlines that never slip by.",
    href: "/opportune",
    icon: "Trophy",
    accent: "violet",
  },
  {
    key: "fixora",
    name: "Fixora",
    tagline: "Campus Maintenance",
    description: "Report, assign and resolve campus issues transparently.",
    href: "/fixora",
    icon: "Wrench",
    accent: "green",
  },
] as const;

export const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  admin: "Administrator",
};

export const PRINT_STATUS_META: Record<
  string,
  { label: string; tone: string; description: string }
> = {
  submitted: {
    label: "Submitted",
    tone: "blue",
    description: "Request received and waiting to enter the print queue.",
  },
  queued: { label: "Queued", tone: "slate", description: "In the print queue, awaiting a printer." },
  processing: {
    label: "Processing",
    tone: "amber",
    description: "The printer is producing this job.",
  },
  ready: {
    label: "Ready for Collection",
    tone: "teal",
    description: "Printed and waiting at the collection desk.",
  },
  completed: { label: "Completed", tone: "green", description: "Collected by the student." },
  cancelled: { label: "Cancelled", tone: "slate", description: "Cancelled before printing began." },
  failed: { label: "Failed", tone: "red", description: "The print job failed and needs attention." },
};

export const MAINTENANCE_STATUS_META: Record<
  string,
  { label: string; tone: string; description: string }
> = {
  submitted: { label: "Submitted", tone: "blue", description: "Waiting for the facilities team to review." },
  under_review: { label: "Under Review", tone: "amber", description: "Being triaged by campus facilities." },
  assigned: { label: "Assigned", tone: "violet", description: "Assigned to a maintenance staff member." },
  in_progress: { label: "In Progress", tone: "orange", description: "Work is underway." },
  resolved: { label: "Resolved", tone: "green", description: "Issue resolved. Thank you for reporting." },
  rejected: { label: "Rejected", tone: "red", description: "Closed without action after review." },
};

export const OPPORTUNITY_CATEGORIES = [
  { value: "hackathon", label: "Hackathon" },
  { value: "internship", label: "Internship" },
  { value: "workshop", label: "Workshop" },
  { value: "technical_event", label: "Technical Event" },
  { value: "competition", label: "Competition" },
  { value: "seminar", label: "Seminar" },
  { value: "placement", label: "Placement" },
  { value: "scholarship", label: "Scholarship" },
] as const;

export const MAINTENANCE_CATEGORIES = [
  "Broken classroom equipment",
  "Electrical issue",
  "Water leakage",
  "Damaged furniture",
  "Internet problem",
  "Cleanliness issue",
  "Laboratory equipment",
  "Other",
] as const;

export const BUILDINGS = ["Main Block", "CSE Block", "Science Block", "Library", "Hostel A", "Workshop"] as const;

export const MAINTENANCE_STAFF = [
  "Ravi Kumar",
  "Sunita Patil",
  "Imran Shaikh",
  "Deepa Rao",
] as const;

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const INTEREST_OPTIONS = OPPORTUNITY_CATEGORIES.map((category) => category.value);
