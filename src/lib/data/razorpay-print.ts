import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function markRazorpayPrintPaymentPaid(
  providerOrderId: string,
  paymentId: string,
  amountPaise: number,
) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false as const, error: "Razorpay payment storage is not configured." };

  const { data: paymentOrder, error: orderError } = await admin
    .from("print_payment_orders")
    .select("provider_order_id, print_request_id, amount_paise, status, payment_id")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (orderError) return { ok: false as const, error: "Could not load the staged Razorpay order." };
  if (!paymentOrder) return { ok: false as const, error: "Razorpay order does not match a staged print request." };
  if (Number(paymentOrder.amount_paise) !== amountPaise) {
    return { ok: false as const, error: "Razorpay payment amount does not match the print bill." };
  }
  if (paymentOrder.status === "paid" && paymentOrder.payment_id === paymentId) {
    return { ok: true as const, requestId: paymentOrder.print_request_id as string };
  }
  if (paymentOrder.status !== "created") {
    return { ok: false as const, error: "This Razorpay order is no longer payable." };
  }

  const { data: updatedRequest, error: requestError } = await admin
    .from("print_requests")
    .update({
      payment_status: "paid",
      payment_reference: paymentId,
      status: "queued",
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentOrder.print_request_id)
    .eq("payment_method", "upi")
    .eq("payment_status", "unpaid")
    .in("status", ["submitted", "queued"])
    .select("id")
    .maybeSingle();
  if (requestError) return { ok: false as const, error: "Could not verify payment for the print request." };
  if (!updatedRequest) {
    const { data: currentRequest } = await admin
      .from("print_requests")
      .select("id, payment_status, payment_reference")
      .eq("id", paymentOrder.print_request_id)
      .maybeSingle();
    if (
      currentRequest?.payment_status !== "paid" ||
      currentRequest.payment_reference !== paymentId
    ) {
      return { ok: false as const, error: "Print request is no longer awaiting this payment." };
    }
  }

  const { error: saveError } = await admin
    .from("print_payment_orders")
    .update({ status: "paid", payment_id: paymentId, updated_at: new Date().toISOString() })
    .eq("provider_order_id", providerOrderId)
    .eq("status", "created")
    .select("provider_order_id")
    .maybeSingle();
  if (saveError) {
    console.error("Could not save Razorpay print payment status", saveError.message);
    return { ok: false as const, error: "Payment was received, but the bill could not be finalized. Contact the print desk." };
  }
  return { ok: true as const, requestId: paymentOrder.print_request_id as string };
}
