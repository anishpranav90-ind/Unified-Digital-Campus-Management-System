"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-state";
import { requireProfile } from "@/lib/session";
import { commentSchema, maintenanceSchema, maintenanceUpdateSchema } from "@/lib/validations";
import {
  addMaintenanceComment,
  createMaintenanceRequest,
  updateMaintenanceRequest,
} from "@/lib/data/fixora";

export async function createMaintenanceRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = maintenanceSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    building: formData.get("building"),
    room: formData.get("room"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the complaint details." };

  const photo = formData.get("photo");
  const result = await createMaintenanceRequest(
    profile,
    parsed.data,
    photo instanceof File && photo.size > 0 ? photo : null,
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/fixora");
  revalidatePath("/dashboard");
  redirect(`/fixora/${result.id}?submitted=1`);
}

export async function updateMaintenanceRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const parsed = maintenanceUpdateSchema.safeParse({
    status: formData.get("status"),
    priority: formData.get("priority"),
    assigned_to: formData.get("assigned_to") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the update values." };

  const photo = formData.get("resolution_photo");
  const result = await updateMaintenanceRequest(
    profile,
    id,
    {
      status: parsed.data.status,
      priority: parsed.data.priority,
      assigned_to: parsed.data.assigned_to || null,
      note: parsed.data.note || null,
    },
    photo instanceof File && photo.size > 0 ? photo : null,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/fixora");
  revalidatePath(`/fixora/${id}`);
  revalidatePath("/dashboard");
  return { success: "Complaint updated. The student has been notified." };
}

export async function addMaintenanceCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const requestId = String(formData.get("request_id") ?? "");
  const parsed = commentSchema.safeParse({
    body: formData.get("body"),
    is_internal: formData.get("is_internal") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Write a comment." };
  const result = await addMaintenanceComment(profile, requestId, parsed.data.body, parsed.data.is_internal);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/fixora/${requestId}`);
  return { success: "Comment added." };
}
