import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createRazorpayWebhookHandler,
  RazorpayWebhookProcessingError,
  type RazorpayWebhookEvent,
} from "@/lib/payments/razorpay-webhook";

async function processRazorpayEvent(event: RazorpayWebhookEvent) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new RazorpayWebhookProcessingError("Payment settlement is not configured.", "CONFIG");

  const { data, error } = await admin.rpc("process_razorpay_webhook_event", {
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_order_id: event.orderId,
    p_payment_id: event.paymentId,
    p_amount_paise: event.amountPaise,
    p_currency: event.currency,
    p_payment_status: event.paymentStatus,
    p_event_created_at: event.eventCreatedAt,
    p_failure_code: event.failureCode,
  });
  if (error) {
    throw new RazorpayWebhookProcessingError("Database rejected the webhook event.", error.code);
  }
  if (data !== "processed" && data !== "duplicate" && data !== "already_paid") {
    throw new RazorpayWebhookProcessingError("Database returned an invalid webhook result.");
  }
  return data;
}

export const razorpayWebhookPOST = createRazorpayWebhookHandler({
  secret: process.env.RAZORPAY_WEBHOOK_SECRET,
  processEvent: processRazorpayEvent,
});
