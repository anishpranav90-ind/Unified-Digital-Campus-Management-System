"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createEcafeOrder } from "@/lib/data/ecafe";
import { ecafeCartSchema } from "@/lib/validations";
import type { Profile } from "@/types";

export type EcafeOrderActionState = {
  error?: string;
  orderId?: string;
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

export async function completeEcafeOrderAction(formData: FormData) {
  const profile = await requireProfile();
  if (profile.role !== "faculty" && profile.role !== "admin") {
    redirect("/ecafe/counter?error=Unauthorized");
  }
  const orderId = String(formData.get("order_id") ?? "");
  if (!/^[\da-f-]{36}$/i.test(orderId)) redirect("/ecafe/counter?error=Invalid+order");
  const { completeEcafeOrder } = await import("@/lib/data/ecafe");
  const result = await completeEcafeOrder(profile, orderId);
  if (!result.ok) redirect(`/ecafe/counter?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/ecafe");
  revalidatePath("/ecafe/counter");
  revalidatePath(`/ecafe/order/${orderId}`);
  redirect("/ecafe/counter?completed=1");
}
