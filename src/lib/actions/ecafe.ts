"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import {
  createEcafeOrder,
  redeemEcafePickup,
  updateEcafeOrderStatus,
  type EcafePickupResult,
} from "@/lib/data/ecafe";
import { ecafeCartSchema } from "@/lib/validations";
import type { Profile } from "@/types";

export type EcafeOrderActionState = {
  error?: string;
  orderId?: string;
};

export type EcafePickupActionState = {
  error?: string;
  result?: EcafePickupResult;
};

export async function createEcafeOrderAction(
  _previous: EcafeOrderActionState,
  formData: FormData,
): Promise<EcafeOrderActionState> {
  const profile: Profile = await requireProfile();
  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "The cart could not be read. Review your selections and try again." };
  }
  const parsed = ecafeCartSchema.safeParse(items);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose valid menu items." };

  const result = await createEcafeOrder(profile, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/ecafe");
  return { orderId: result.id };
}

export async function updateEcafeOrderStatusAction(formData: FormData) {
  const profile = await requireProfile();
  if (profile.role !== "faculty" && profile.role !== "admin") {
    redirect("/ecafe/counter?error=Unauthorized");
  }
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[\da-f-]{36}$/i.test(orderId)) redirect("/ecafe/counter?error=Invalid+order");
  const status = String(formData.get("status") ?? "");
  if (status !== "PREPARING" && status !== "READY") {
    redirect("/ecafe/counter?error=Invalid+order+status");
  }
  const result = await updateEcafeOrderStatus(profile, orderId, status);
  if (!result.ok) redirect(`/ecafe/counter?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/ecafe");
  revalidatePath("/ecafe/board");
  revalidatePath("/ecafe/counter");
  revalidatePath(`/ecafe/order/${orderId}`);
  redirect(`/ecafe/counter?updated=${status.toLowerCase()}`);
}

export async function redeemEcafePickupAction(
  _previous: EcafePickupActionState,
  formData: FormData,
): Promise<EcafePickupActionState> {
  const profile = await requireProfile();
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { error: "Only authorized cafe counter staff can scan pickup QR codes." };
  }
  const rawQr = String(formData.get("qr") ?? "").trim();
  const match = /^unisync-ecafe-pickup:\/\/([0-9a-f]{64})$/i.exec(rawQr);
  if (!match) return { error: "Scan or enter a valid e-Cafe pickup QR code." };

  const result = await redeemEcafePickup(profile, match[1].toLowerCase());
  if (!result.found) return { error: "Pickup QR not recognized. Ask the student to open their order." };
  if (!result.completed) {
    return {
      error: `Order not ready yet! Current queue position: ${result.queue_position ?? 0}.`,
      result,
    };
  }

  revalidatePath("/ecafe");
  revalidatePath("/ecafe/board");
  revalidatePath("/ecafe/counter");
  if (result.order_number) revalidatePath("/ecafe/order/[id]", "page");
  return { result };
}
