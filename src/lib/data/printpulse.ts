import "server-only";
import type {
  PrintRequest,
  PrintSettings,
  PrintStatus,
  Profile,
  QueueInfo,
} from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyByRoles, notifyUsers, writeAuditLog } from "@/lib/data/helpers";
import { calculatePrintCost } from "@/lib/print";
import { getPrinterAdapter } from "@/lib/printer";

export { calculatePrintCost };

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  id: "default",
  bw_single: 2,
  bw_double: 3,
  color_single: 5,
  color_double: 8,
  avg_processing_minutes: 4,
  max_pages_per_job: 100,
  printer_mode: "simulated",
  updated_at: new Date().toISOString(),
};

export async function getPrintSettings(): Promise<PrintSettings> {
  if (isDemoMode()) return getDemoStore().print_settings;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("print_queue_settings").select("*").limit(1).maybeSingle();
  const settings = (data as PrintSettings) ?? DEFAULT_PRINT_SETTINGS;
  const envMode = process.env.PRINTER_MODE;
  return {
    ...settings,
    printer_mode: envMode === "cups" ? "cups" : envMode === "simulated" ? "simulated" : settings.printer_mode,
  };
}

export async function updatePrintSettings(profile: Profile, input: Partial<PrintSettings>) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can update print pricing." };
  if (isDemoMode()) {
    const store = getDemoStore();
    Object.assign(store.print_settings, input, { updated_at: new Date().toISOString() });
    await writeAuditLog(profile, "print.settings_updated", "print_queue_settings", store.print_settings.id);
    return { ok: true as const };
  }
  const supabase = await createSupabaseServerClient();
  const settings = await getPrintSettings();
  const { error } = await supabase
    .from("print_queue_settings")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", settings.id);
  if (error) return { ok: false as const, error: error.message };
  await writeAuditLog(profile, "print.settings_updated", "print_queue_settings", settings.id);
  return { ok: true as const };
}

const ACTIVE_STATUSES: PrintStatus[] = ["submitted", "queued", "processing"];

export async function getPrintQueueInfo(profile: Profile): Promise<QueueInfo> {
  const settings = await getPrintSettings();

  if (isDemoMode()) {
    const active = getDemoStore()
      .print_requests.filter((request) => ACTIVE_STATUSES.includes(request.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const pending = active.filter((request) => request.status !== "processing").length;
    const processing = active.filter((request) => request.status === "processing").length;
    const mine = active.find((request) => request.student_id === profile.id);
    const position = mine ? active.findIndex((request) => request.id === mine.id) + 1 : null;
    const ahead = position ? position - 1 : 0;
    return {
      pending,
      processing,
      position,
      estimated_wait_minutes: position ? ahead * settings.avg_processing_minutes : 0,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_print_queue_info");
  if (error || !data) {
    return { pending: 0, processing: 0, position: null, estimated_wait_minutes: 0 };
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    pending: number;
    processing: number;
    my_position: number | null;
    estimated_wait_minutes: number;
  };
  return {
    pending: Number(row.pending ?? 0),
    processing: Number(row.processing ?? 0),
    position: row.my_position ? Number(row.my_position) : null,
    estimated_wait_minutes: Number(row.estimated_wait_minutes ?? 0),
  };
}

export async function listPrintRequests(
  profile: Profile,
  options: { status?: string; limit?: number } = {},
): Promise<PrintRequest[]> {
  const { status, limit = 60 } = options;
  if (isDemoMode()) {
    const store = getDemoStore();
    return store.print_requests
      .filter((request) => (profile.role === "student" ? request.student_id === profile.id : true))
      .filter((request) => (status && status !== "all" ? request.status === status : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((request) => ({
        ...request,
        student: store.profiles.find((item) => item.id === request.student_id) ?? null,
      }));
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("print_requests")
    .select("*, student:profiles!print_requests_student_id_fkey(id, full_name, email, roll_number)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (profile.role === "student") query = query.eq("student_id", profile.id);
  if (status && status !== "all") query = query.eq("status", status);
  const { data } = await query;
  return (data ?? []) as PrintRequest[];
}

export async function getPrintRequest(profile: Profile, id: string): Promise<PrintRequest | null> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const request = store.print_requests.find((item) => item.id === id);
    if (!request) return null;
    if (profile.role === "student" && request.student_id !== profile.id) return null;
    return {
      ...request,
      student: store.profiles.find((item) => item.id === request.student_id) ?? null,
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("print_requests")
    .select("*, student:profiles!print_requests_student_id_fkey(id, full_name, email, roll_number)")
    .eq("id", id)
    .maybeSingle();
  return (data as PrintRequest) ?? null;
}

export function validatePdfFile(file: File | null, maxPages: number, pages: number) {
  if (!file || file.size === 0) return "Attach a PDF document.";
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return "Only PDF files are accepted.";
  }
  if (file.size > 5 * 1024 * 1024) return "The PDF must be 5 MB or smaller.";
  if (pages > maxPages) return `This queue accepts up to ${maxPages} pages per job. Split larger documents.`;
  return null;
}

export async function createPrintRequest(
  profile: Profile,
  input: {
    document_name: string;
    pages: number;
    page_range: string | null;
    copies: number;
    color_mode: "bw" | "color";
    sides: "single" | "double";
    priority: "normal" | "urgent";
    notes: string | null;
  },
  file: File,
) {
  if (profile.role !== "student") {
    return { ok: false as const, error: "Only students can submit print requests." };
  }
  const settings = await getPrintSettings();
  const fileError = validatePdfFile(file, settings.max_pages_per_job, input.pages);
  if (fileError) return { ok: false as const, error: fileError };

  const estimated_cost = calculatePrintCost(settings, input);

  if (isDemoMode()) {
    const store = getDemoStore();
    const request: PrintRequest = {
      id: crypto.randomUUID(),
      request_number: `PP-${1000 + store.print_requests.length + 1}`,
      student_id: profile.id,
      student: { id: profile.id, full_name: profile.full_name, email: profile.email, roll_number: profile.roll_number },
      document_name: input.document_name,
      file_path: null,
      file_size: file.size,
      pages: input.pages,
      page_range: input.page_range,
      copies: input.copies,
      color_mode: input.color_mode,
      sides: input.sides,
      status: "submitted",
      estimated_cost,
      payment_status: "not_required",
      payment_method: "none",
      priority: input.priority,
      print_mode: settings.printer_mode,
      notes: input.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.print_requests.unshift(request);
    await notifyByRoles(["admin"], {
      title: `New print request ${request.request_number}`,
      body: `${profile.full_name} · ${input.document_name} · ${input.pages} pages`,
      type: "print",
      link: `/printpulse/${request.id}`,
    });
    await notifyUsers([profile.id], {
      title: "Print request submitted",
      body: `${request.request_number} is in the queue. Estimated cost ₹${estimated_cost}.`,
      type: "print",
      link: `/printpulse/${request.id}`,
    });
    return { ok: true as const, id: request.id, simulated: true };
  }

  const supabase = await createSupabaseServerClient();
  const path = `${profile.id}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("print-documents")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { ok: false as const, error: `Upload failed: ${uploadError.message}` };

  const { data, error } = await supabase
    .from("print_requests")
    .insert({
      student_id: profile.id,
      document_name: input.document_name,
      file_path: path,
      file_size: file.size,
      pages: input.pages,
      page_range: input.page_range,
      copies: input.copies,
      color_mode: input.color_mode,
      sides: input.sides,
      estimated_cost,
      priority: input.priority,
      print_mode: settings.printer_mode,
      notes: input.notes,
      status: "submitted",
    })
    .select("id, request_number")
    .single();
  if (error) {
    await supabase.storage.from("print-documents").remove([path]);
    return { ok: false as const, error: error.message };
  }

  await notifyByRoles(["admin"], {
    title: `New print request ${data.request_number}`,
    body: `${profile.full_name} · ${input.document_name} · ${input.pages} pages`,
    type: "print",
    link: `/printpulse/${data.id}`,
  });
  await notifyUsers([profile.id], {
    title: "Print request submitted",
    body: `${data.request_number} is in the queue. Estimated cost ₹${estimated_cost}.`,
    type: "print",
    link: `/printpulse/${data.id}`,
  });
  return { ok: true as const, id: data.id as string, simulated: settings.printer_mode === "simulated" };
}

export async function cancelPrintRequest(profile: Profile, id: string) {
  const request = await getPrintRequest(profile, id);
  if (!request) return { ok: false as const, error: "Print request not found." };
  if (profile.role === "student" && request.student_id !== profile.id) {
    return { ok: false as const, error: "You cannot cancel another student's request." };
  }
  if (!["submitted", "queued"].includes(request.status)) {
    return { ok: false as const, error: "This job can no longer be cancelled once processing has started." };
  }

  if (isDemoMode()) {
    const target = getDemoStore().print_requests.find((item) => item.id === id);
    if (target) {
      target.status = "cancelled";
      target.updated_at = new Date().toISOString();
    }
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("print_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["submitted", "queued"]);
    if (error) return { ok: false as const, error: error.message };
  }

  if (profile.role !== "student") {
    await notifyUsers([request.student_id], {
      title: `Print request ${request.request_number} cancelled`,
      body: "Your print request was cancelled by the print desk.",
      type: "print",
      link: `/printpulse/${request.id}`,
    });
  }
  await writeAuditLog(profile, "print.cancelled", "print_requests", id);
  return { ok: true as const };
}

export async function updatePrintRequestStatus(
  profile: Profile,
  id: string,
  status: PrintStatus,
  note?: string,
) {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { ok: false as const, error: "Only print desk staff can update job status." };
  }
  const request = await getPrintRequest(profile, id);
  if (!request) return { ok: false as const, error: "Print request not found." };

  if (status === "ready" || status === "completed") {
    const printer = getPrinterAdapter(request.print_mode);
    if (!printer.isAvailable()) {
      return {
        ok: false as const,
        error:
          "The physical printer adapter is not configured or tested. Keep the job in processing until CUPS/IPP is verified.",
      };
    }
  }

  if (isDemoMode()) {
    const target = getDemoStore().print_requests.find((item) => item.id === id);
    if (!target) return { ok: false as const, error: "Print request not found." };
    target.status = status;
    target.updated_at = new Date().toISOString();
    if (note) target.notes = note;
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("print_requests")
      .update({ status, notes: note ?? request.notes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false as const, error: error.message };
  }

  const statusCopy: Record<string, string> = {
    queued: "is queued for printing",
    processing: "is being printed",
    ready: "is ready for collection at the print desk",
    completed: "has been completed",
    failed: "failed. Please contact the print desk.",
    cancelled: "was cancelled",
  };
  await notifyUsers([request.student_id], {
    title: `Print request ${request.request_number} updated`,
    body: `${request.document_name} ${statusCopy[status] ?? "was updated"}.`,
    type: "print",
    link: `/printpulse/${request.id}`,
  });
  await writeAuditLog(profile, "print.status_updated", "print_requests", id, { status });
  return { ok: true as const };
}

export async function getPrintFileUrl(profile: Profile, path: string | null) {
  if (!path || isDemoMode()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.storage.from("print-documents").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function getDailyPrintStats(days = 7) {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const buckets: { date: string; label: string; jobs: number; pages: number; revenue: number }[] = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    buckets.push({
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      jobs: 0,
      pages: 0,
      revenue: 0,
    });
  }

  let requests: Pick<PrintRequest, "created_at" | "pages" | "estimated_cost" | "status">[] = [];
  if (isDemoMode()) {
    requests = getDemoStore().print_requests;
  } else {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("print_requests")
      .select("created_at, pages, estimated_cost, status")
      .gte("created_at", start.toISOString())
      .limit(500);
    requests = (data ?? []) as typeof requests;
  }

  requests.forEach((request) => {
    const key = request.created_at.slice(0, 10);
    const bucket = buckets.find((item) => item.date === key);
    if (!bucket) return;
    bucket.jobs += 1;
    bucket.pages += request.pages;
    if (request.status !== "cancelled") bucket.revenue += Number(request.estimated_cost);
  });
  return buckets;
}
