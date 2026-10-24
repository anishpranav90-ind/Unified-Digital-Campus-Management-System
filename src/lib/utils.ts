import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | Date | null | undefined, pattern = "dd MMM yyyy") {
  if (!value) return "n/a";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "n/a";
  return format(date, pattern);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "n/a";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "n/a";
  return format(date, "dd MMM yyyy, h:mm a");
}

export function timeAgo(value: string | Date | null | undefined) {
  if (!value) return "n/a";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "n/a";
  return formatDistanceToNow(date, { addSuffix: true });
}

export function isSameDay(value: string | Date, reference = new Date()) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return isToday(date) && date.getDate() === reference.getDate();
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "n/a";
  const [h, m] = value.slice(0, 5).split(":");
  const hours = Number(h);
  if (Number.isNaN(hours)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 || 12;
  return `${display}:${m ?? "00"} ${suffix}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(day: number) {
  return DAY_NAMES[day] ?? "N/A";
}

export function todayDayNumber() {
  const day = new Date().getDay();
  return day === 0 ? 7 : day; // Sunday = 7 (no classes in seed)
}

export function minutesFromTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function safeExternalUrl(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function fileSizeLabel(bytes: number | null | undefined) {
  if (!bytes) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function firstName(fullName: string) {
  return fullName
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, "")
    .split(" ")[0];
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/** Whole days left until a deadline, never negative. */
export function daysUntil(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

export function isPast(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return date.getTime() < Date.now();
}
