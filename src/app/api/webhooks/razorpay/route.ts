import { z } from "zod";
import { markRazorpayPrintPaymentPaid } from "@/lib/data/razorpay-print";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";

const WebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string().min(1),
        order_id: z.string().min(1),
        amount: z.number().int().positive(),
        currency: z.literal("INR"),
        status: z.string(),
      }),
    }),
  }),
});

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let untrustedBody: unknown;
  try {
    untrustedBody = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  const parsed = WebhookSchema.safeParse(untrustedBody);
  if (!parsed.success) return Response.json({ error: "Invalid webhook payload." }, { status: 400 });

  if (parsed.data.event !== "payment.captured") {
    return Response.json({ received: true });
  }

  const payment = parsed.data.payload.payment.entity;
  if (payment.status !== "captured") {
    return Response.json({ error: "Webhook payment is not captured." }, { status: 400 });
  }
  const result = await markRazorpayPrintPaymentPaid(
    payment.order_id,
    payment.id,
    payment.amount,
  );
  if (!result.ok) {
    console.error("Razorpay webhook could not finalize print request", result.error);
    return Response.json({ error: result.error }, { status: 500 });
  }
  return Response.json({ received: true });
}
