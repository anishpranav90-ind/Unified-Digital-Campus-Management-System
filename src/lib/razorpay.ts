import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const OrderResponseSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
  status: z.string(),
});

const PaymentResponseSchema = z.object({
  id: z.string().min(1),
  order_id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
  status: z.string(),
});

export function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return keyId && keySecret ? { keyId, keySecret } : null;
}

export function getRazorpayPublicKey() {
  const config = getRazorpayConfig();
  return config && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? config.keyId : "";
}

function authHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function createRazorpayOrder(amount: number, receipt: string) {
  const config = getRazorpayConfig();
  if (!config) throw new Error("Razorpay is not configured on the server.");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader(config.keyId, config.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, currency: "INR", receipt }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Razorpay order creation failed with HTTP status", response.status);
    throw new Error("Razorpay could not create the payment order. Try again or contact the print desk.");
  }

  const parsed = OrderResponseSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.amount !== amount) {
    throw new Error("Razorpay returned an invalid payment order.");
  }
  return parsed.data;
}

export function verifyRazorpayCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const config = getRazorpayConfig();
  if (!config || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", config.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function getRazorpayPayment(paymentId: string) {
  const config = getRazorpayConfig();
  if (!config) throw new Error("Razorpay is not configured on the server.");
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: { Authorization: authHeader(config.keyId, config.keySecret) },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    console.error("Razorpay payment lookup failed with HTTP status", response.status);
    throw new Error("Could not verify the Razorpay payment. Please retry or contact the print desk.");
  }

  const parsed = PaymentResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Razorpay returned an invalid payment record.");
  return parsed.data;
}

export function verifyRazorpayWebhookSignature(body: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
