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
import { getPrinterAdapter, type PrintReceipt } from "@/lib/printer";
import type { PrintLocation } from "@/lib/print-locations";

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
  return (data as PrintSettings) ?? DEFAULT_PRINT_SETTINGS;
}

export async function updatePrintSettings(profile: Profile, input: Partial<PrintSettings>) {
  if (profile.role !== "admin") return { ok: false as const, error: "Only administrators can update print pricing." };
  if (isDemoMode()) {
    if (input.printer_mode === "cups") {
      return { ok: false as const, error: "CUPS printing cannot be enabled in demo mode." };
    }
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
      .print_requests.filter(
        (request) =>
          ACTIVE_STATUSES.includes(request.status) &&
          ["paid", "not_required"].includes(request.payment_status) &&
          Boolean(request.file_path),
      )
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
    print_location: PrintLocation;
    pages: number;
    paper_size: "a4" | "a3" | "letter";
    page_range: string | null;
    copies: number;
    color_mode: "bw" | "color";
    sides: "single" | "double";
    priority: "normal" | "urgent";
    notes: string | null;
    payment_option: "upi" | "razorpay" | "cash";
  },
  file: File | null,
) {
  if (profile.role !== "student") {
    return { ok: false as const, error: "Only students can submit print requests." };
  }
  const settings = await getPrintSettings();
  if (input.payment_option === "cash" && !file) {
    return { ok: false as const, error: "Attach a PDF before creating a cash authorization." };
  }
  const fileError = file ? validatePdfFile(file, settings.max_pages_per_job, input.pages) : null;
  if (fileError) return { ok: false as const, error: fileError };

  const estimated_cost = calculatePrintCost(settings, input);

  if (isDemoMode()) {
    const store = getDemoStore();
    const request: PrintRequest = {
      id: crypto.randomUUID(),
      request_number: `PP-${1000 + store.print_requests.length + 1}`,
      student_id: profile.id,
      print_location: input.print_location,
      student: { id: profile.id, full_name: profile.full_name, email: profile.email, roll_number: profile.roll_number },
      document_name: input.document_name,
      file_path: file ? `demo:${file.name}` : null,
      file_size: file?.size ?? null,
      pages: input.pages,
      paper_size: input.paper_size,
      page_range: input.page_range,
      copies: input.copies,
      color_mode: input.color_mode,
      sides: input.sides,
      status: "payment_pending",
      estimated_cost,
      payment_status: "unpaid",
      payment_method: "none",
      payment_option: input.payment_option,
      upload_after_payment: input.payment_option !== "cash",
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
      title: "Print request created",
      body: `${request.request_number} is awaiting payment verification. Estimated cost ₹${estimated_cost}.`,
      type: "print",
      link: `/printpulse/${request.id}`,
    });
    return { ok: true as const, id: request.id, simulated: true };
  }

  const supabase = await createSupabaseServerClient();
  let path: string | null = null;
  if (file) {
    path = `${profile.id}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("print-documents")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) return { ok: false as const, error: `Upload failed: ${uploadError.message}` };
  }

  const { data, error } = await supabase
    .from("print_requests")
    .insert({
      student_id: profile.id,
      document_name: input.document_name,
      print_location: input.print_location,
      file_path: path,
      file_size: file?.size ?? null,
      pages: input.pages,
      paper_size: input.paper_size,
      page_range: input.page_range,
      copies: input.copies,
      color_mode: input.color_mode,
      sides: input.sides,
      estimated_cost,
      priority: input.priority,
      print_mode: settings.printer_mode,
      notes: input.notes,
      status: "payment_pending",
      payment_status: "unpaid",
      payment_method: "none",
      payment_option: input.payment_option,
      upload_after_payment: input.payment_option !== "cash",
    })
    .select("id, request_number")
    .single();
  if (error) {
    if (path) await supabase.storage.from("print-documents").remove([path]);
    return { ok: false as const, error: error.message };
  }

  await notifyByRoles(["admin"], {
    title: `New print request ${data.request_number}`,
    body: `${profile.full_name} · ${input.document_name} · ${input.pages} pages`,
    type: "print",
    link: `/printpulse/${data.id}`,
  });
  await notifyUsers([profile.id], {
    title: "Print request created",
    body: `${data.request_number} is awaiting payment verification. Estimated cost ₹${estimated_cost}.`,
    type: "print",
    link: `/printpulse/${data.id}`,
  });
  return { ok: true as const, id: data.id as string, simulated: settings.printer_mode === "simulated" };
}

export async function attachPaidPrintFile(
  profile: Profile,
  id: string,
  file: File,
) {
  const request = await getPrintRequest(profile, id);
  if (!request || request.student_id !== profile.id) {
    return { ok: false as const, error: "Print request not found." };
  }
  if (
    !request.upload_after_payment ||
    request.payment_status !== "paid" ||
    request.file_path ||
    request.status !== "payment_pending"
  ) {
    return { ok: false as const, error: "This request is not awaiting a post-payment PDF upload." };
  }
  const settings = await getPrintSettings();
  const fileError = validatePdfFile(file, settings.max_pages_per_job, request.pages);
  if (fileError) return { ok: false as const, error: fileError };

  if (isDemoMode()) {
    const target = getDemoStore().print_requests.find((item) => item.id === id);
    if (!target) return { ok: false as const, error: "Print request not found." };
    target.file_path = `demo:${file.name}`;
    target.file_size = file.size;
    target.upload_after_payment = false;
    target.status = "submitted";
    target.updated_at = new Date().toISOString();
    return { ok: true as const };
  }

  const supabase = await createSupabaseServerClient();
  const path = `${profile.id}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("print-documents")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { ok: false as const, error: `Upload failed: ${uploadError.message}` };

  const { data, error } = await supabase.rpc("attach_paid_print_file", {
    p_request_id: id,
    p_file_path: path,
    p_file_size: file.size,
  });
  if (error || !data) {
    const { error: cleanupError } = await supabase.storage.from("print-documents").remove([path]);
    if (cleanupError) {
      console.error("Could not remove staged PDF after failed attachment", {
        requestId: id,
        path,
        error: cleanupError.message,
      });
    }
    return {
      ok: false as const,
      error: error?.message ?? "Payment was verified, but the file could not be attached. Try again.",
    };
  }
  return { ok: true as const };
}

export async function cancelPrintRequest(profile: Profile, id: string) {
  const request = await getPrintRequest(profile, id);
  if (!request) return { ok: false as const, error: "Print request not found." };
  if (profile.role === "student" && request.student_id !== profile.id) {
    return { ok: false as const, error: "You cannot cancel another student's request." };
  }
  if (!["payment_pending", "submitted", "queued"].includes(request.status)) {
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
      .in("status", ["payment_pending", "submitted", "queued"]);
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
  if (request.payment_status === "unpaid") {
    return { ok: false as const, error: "Payment must be verified before this job can enter the print queue." };
  }
  if (!request.file_path && status !== "failed" && status !== "cancelled") {
    return { ok: false as const, error: "The PDF must be attached before this job can enter the print queue." };
  }

  let submittedPrinterJobId: number | undefined;
  const isCupsJob = request.print_mode === "cups";
  const isStartingCupsJob = isCupsJob && status === "processing";

  if (isCupsJob && request.printer_job_id && ["submitted", "queued", "cancelled"].includes(status)) {
    return { ok: false as const, error: "CUPS already accepted this job. Verify the printer queue before changing its state." };
  }

  if (isCupsJob && (status === "ready" || status === "completed") && !request.printer_job_id) {
    return { ok: false as const, error: "Submit this job to CUPS from Processing before marking it ready." };
  }

  if (isCupsJob && !request.printer_job_id && ["processing", "failed"].includes(request.status)) {
    if (status !== "failed") {
      return {
        ok: false as const,
        error: "This CUPS submission has no saved job ID. Check the CUPS queue before changing or retrying it.",
      };
    }
  }

  if (isStartingCupsJob && request.printer_job_id) {
    if (request.status === "processing") return { ok: true as const, printerJobId: request.printer_job_id };
    return { ok: false as const, error: `CUPS already accepted this job as job ${request.printer_job_id}.` };
  }

  if (isStartingCupsJob && !["submitted", "queued"].includes(request.status)) {
    return { ok: false as const, error: "Only submitted or queued jobs can be sent to CUPS." };
  }

  if (isStartingCupsJob) {
    const printer = getPrinterAdapter("cups");
    if (!printer.isAvailable(request.print_location)) {
      return {
        ok: false as const,
        error: `Configure the IPP URI for ${request.print_location} and valid IPPS credentials before printing.`,
      };
    }

    const fileUrl = await getPrintFileUrl(profile, request.file_path);
    if (!fileUrl) return { ok: false as const, error: "The uploaded PDF could not be accessed." };
    const fileResponse = await fetch(fileUrl, { cache: "no-store" });
    if (!fileResponse.ok) return { ok: false as const, error: "The uploaded PDF could not be downloaded." };
    const pdf = Buffer.from(await fileResponse.arrayBuffer());

    const supabase = await createSupabaseServerClient();
    const { data: claimed, error: claimError } = await supabase
      .from("print_requests")
      .update({ status: "processing", notes: note ?? request.notes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["submitted", "queued"])
      .is("printer_job_id", null)
      .select("id")
      .maybeSingle();
    if (claimError) return { ok: false as const, error: claimError.message };
    if (!claimed) return { ok: false as const, error: "Another staff member already claimed this print job." };

    let receipt: PrintReceipt;
    try {
      receipt = await printer.submit({
        requestNumber: request.request_number,
        printLocation: request.print_location,
        filePath: request.file_path,
        pages: request.pages,
        paperSize: request.paper_size,
        pageRange: request.page_range,
        copies: request.copies,
        colorMode: request.color_mode,
        sides: request.sides,
        pdf,
      });
    } catch (error) {
      return {
        ok: false as const,
        error: `CUPS submission did not complete. The request remains in Processing; verify the CUPS queue before retrying. ${error instanceof Error ? error.message : ""}`.trim(),
      };
    }

    const { error: receiptError } = await supabase
      .from("print_requests")
      .update({ printer_job_id: receipt.printerJobId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "processing");
    if (receiptError) {
      return {
        ok: false as const,
        error: `CUPS accepted job ${receipt.printerJobId}, but UniSync could not save its ID. Check CUPS before changing this request.`,
      };
    }
    submittedPrinterJobId = receipt.printerJobId;
  } else if (isDemoMode()) {
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
  return { ok: true as const, printerJobId: submittedPrinterJobId };
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
