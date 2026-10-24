"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-state";
import { requireProfile } from "@/lib/session";
import { printRequestSchema, printSettingsSchema, printStatusSchema } from "@/lib/validations";
import {
  cancelPrintRequest,
  createPrintRequest,
  updatePrintRequestStatus,
  updatePrintSettings,
} from "@/lib/data/printpulse";

export async function createPrintRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = printRequestSchema.safeParse({
    document_name: formData.get("document_name"),
    pages: formData.get("pages"),
    page_range: formData.get("page_range") ?? "",
    copies: formData.get("copies"),
    color_mode: formData.get("color_mode"),
    sides: formData.get("sides"),
    priority: formData.get("priority") ?? "normal",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the request details." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Attach a PDF document." };

  const result = await createPrintRequest(
    profile,
    {
      document_name: parsed.data.document_name,
      pages: parsed.data.pages,
      page_range: parsed.data.page_range || null,
      copies: parsed.data.copies,
      color_mode: parsed.data.color_mode,
      sides: parsed.data.sides,
      priority: parsed.data.priority,
      notes: parsed.data.notes || null,
    },
    file,
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/printpulse");
  revalidatePath("/dashboard");
  redirect(`/printpulse/${result.id}`);
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
  return { success: "Print job updated and the student was notified." };
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
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the pricing values." };
  const result = await updatePrintSettings(profile, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/printpulse");
  return { success: "Print pricing and queue timings updated." };
}
