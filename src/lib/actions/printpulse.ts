"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-state";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import { printRequestSchema, printSettingsSchema, printStatusSchema } from "@/lib/validations";
import {
  attachPaidPrintFile,
  cancelPrintRequest,
  createPrintRequest,
  updatePrintRequestStatus,
  updatePrintSettings,
} from "@/lib/data/printpulse";

export async function createPrintRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = printRequestSchema.safeParse({
    document_name: formData.get("document_name"),
    print_location: formData.get("print_location"),
    pages: formData.get("pages"),
    paper_size: formData.get("paper_size") ?? "a4",
    page_range: formData.get("page_range") ?? "",
    copies: formData.get("copies"),
    color_mode: formData.get("color_mode"),
    sides: formData.get("sides"),
    priority: formData.get("priority") ?? "normal",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the request details." };

  const file = formData.get("file");
  const paymentOption = String(formData.get("payment_option") ?? "");
  if (paymentOption !== "upi" && paymentOption !== "razorpay" && paymentOption !== "cash") {
    return { error: "Choose UPI, Razorpay, or cash payment." };
  }
  if (
    paymentOption === "upi" &&
    (!process.env.UPI_PAYEE_VPA || !/^[\w.-]+@[\w.-]+$/.test(process.env.UPI_PAYEE_VPA))
  ) {
    return { error: "Direct UPI is not configured. Choose cash or configure a valid UPI_PAYEE_VPA." };
  }
  if (paymentOption === "razorpay") {
    if (isDemoMode()) {
      return { error: "Razorpay checkout requires Supabase-backed mode. Configure Supabase and disable demo mode first." };
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: "Razorpay settlement is unavailable: set the server-side SUPABASE_SERVICE_ROLE_KEY in .env.local and restart the app." };
    }
    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET ||
      !process.env.RAZORPAY_WEBHOOK_SECRET
    ) {
      return { error: "Razorpay is missing server configuration. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET." };
    }
  }
  if (!(file instanceof File) && paymentOption === "cash") return { error: "Attach a PDF for cash payment." };

  const result = await createPrintRequest(
    profile,
    {
      document_name: parsed.data.document_name,
      print_location: parsed.data.print_location,
      pages: parsed.data.pages,
      paper_size: parsed.data.paper_size,
      page_range: parsed.data.page_range || null,
      copies: parsed.data.copies,
      color_mode: parsed.data.color_mode,
      sides: parsed.data.sides,
      priority: parsed.data.priority,
      notes: parsed.data.notes || null,
      payment_option: paymentOption,
    },
    file instanceof File ? file : null,
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/printpulse");
  revalidatePath("/dashboard");
  redirect(`/printpulse/${result.id}?pay=${paymentOption}`);
}

export async function attachPaidPrintFileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!/^[\da-f-]{36}$/i.test(id)) return { error: "Invalid print request." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Attach a PDF document." };
  const result = await attachPaidPrintFile(profile, id, file);
  if (!result.ok) return { error: result.error };
  revalidatePath("/printpulse");
  revalidatePath(`/printpulse/${id}`);
  revalidatePath("/dashboard");
  return { success: "PDF attached. Your verified job is now in the print queue." };
}

export async function cancelPrintRequestAction(formData: FormData) {
  const profile = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const result = await cancelPrintRequest(profile, id);
  revalidatePath("/printpulse");
  revalidatePath(`/printpulse/${id}`);
  revalidatePath("/dashboard");
  if (!result.ok) redirect(`/printpulse/${id}?error=${encodeURIComponent(result.error)}`);
  redirect(`/printpulse/${id}?cancelled=1`);
}

export async function updatePrintStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const parsedStatus = printStatusSchema.safeParse(formData.get("status"));
  if (!parsedStatus.success) return { error: "Choose a valid status." };

  const result = await updatePrintRequestStatus(
    profile,
    id,
    parsedStatus.data,
    (formData.get("note") as string) || undefined,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/printpulse");
  revalidatePath(`/printpulse/${id}`);
  revalidatePath("/dashboard");
  return {
    success: result.printerJobId
      ? `Submitted to CUPS as job ${result.printerJobId}. Confirm the output before marking it ready.`
      : "Print job updated and the student was notified.",
  };
}

export async function updatePrintSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = printSettingsSchema.safeParse({
    bw_single: formData.get("bw_single"),
    bw_double: formData.get("bw_double"),
    color_single: formData.get("color_single"),
    color_double: formData.get("color_double"),
    avg_processing_minutes: formData.get("avg_processing_minutes"),
    max_pages_per_job: formData.get("max_pages_per_job"),
    printer_mode: formData.get("printer_mode"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the pricing values." };
  const result = await updatePrintSettings(profile, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/printpulse");
  return { success: "Print pricing, queue timings, and printer mode updated." };
}
