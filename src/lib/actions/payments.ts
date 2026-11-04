"use server";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { startPaymentTransaction, verifyCounterPayment, getRazorpayTransaction, settleVerifiedRazorpayPayment } from "@/lib/data/payments";
import type { PaymentMethod } from "@/types";
import { isDemoMode } from "@/lib/env";

export type PaymentActionState = {
  error?: string;
  success?: string;
  method?: PaymentMethod;
  transactionId?: string;
  amountPaise?: number;
  qrValue?: string;
  counterQrValue?: string;
  upiUri?: string;
  razorpayKey?: string;
  razorpayOrderId?: string;
};

function isPaymentMethod(value: string): value is PaymentMethod {
  return value === "upi" || value === "razorpay" || value === "cash";
}

function timingSafeHexEqual(left: string, right: string) {
  if (!/^[\da-f]+$/i.test(left) || !/^[\da-f]+$/i.test(right) || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export async function startPaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const profile = await requireProfile();
  const moduleValue = formData.get("module");
  const entityId = String(formData.get("entity_id") ?? "");
  const methodValue = String(formData.get("method") ?? "");
  if ((moduleValue !== "printpulse" && moduleValue !== "ecafe") || !/^[\da-f-]{36}$/i.test(entityId)) {
    return { error: "The order details are invalid." };
  }
  if (!isPaymentMethod(methodValue)) return { error: "Select a valid payment method." };
  if (moduleValue === "printpulse") {
    const { getPrintRequest } = await import("@/lib/data/printpulse");
    const request = await getPrintRequest(profile, entityId);
    if (!request || request.payment_option !== methodValue) {
      return { error: "Choose the payment method selected for this print request." };
    }
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const payeeVpa = process.env.UPI_PAYEE_VPA;
  if (methodValue === "razorpay" && isDemoMode()) {
    return { error: "Razorpay checkout requires a connected Supabase project and webhook settlement configuration." };
  }
  if (
    methodValue === "razorpay" &&
    (!process.env.RAZORPAY_WEBHOOK_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    return { error: "Razorpay settlement is not configured. Set the webhook secret and Supabase service-role key." };
  }
  if (methodValue === "razorpay" && (!keyId || !keySecret)) {
    return { error: "Razorpay is not configured. Choose UPI or cash, or configure Razorpay server credentials." };
  }
  if (methodValue === "upi" && (!payeeVpa || !/^[\w.-]+@[\w.-]+$/.test(payeeVpa))) {
    return { error: "Direct UPI is not configured. Set a valid server-only UPI_PAYEE_VPA." };
  }

  const counterToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(counterToken).digest("hex");
  const transaction = await startPaymentTransaction(
    profile,
    moduleValue,
    entityId,
    methodValue,
    tokenHash,
    counterToken,
  );
  if (!transaction.ok) return { error: transaction.error };

  const qrValue = transaction.counterToken
    ? `unisync-pay://${transaction.id}/${transaction.counterToken}`
    : undefined;
  if (methodValue === "cash") {
    if (!qrValue) return { error: "The counter authorization QR could not be restored. Contact counter staff." };
    return {
      method: methodValue,
      transactionId: transaction.id,
      amountPaise: transaction.amountPaise,
      qrValue,
    };
  }

  if (methodValue === "upi") {
    if (!qrValue) return { error: "The counter verification QR could not be restored. Contact counter staff." };
    const rupees = (transaction.amountPaise / 100).toFixed(2);
    const payeeName = encodeURIComponent(process.env.UPI_PAYEE_NAME || "UniSync Campus");
    const note = encodeURIComponent(`UniSync ${moduleValue} ${transaction.id}`);
    const upiUri = `upi://pay?pa=${encodeURIComponent(payeeVpa!)}&pn=${payeeName}&am=${rupees}&cu=INR&tn=${note}&tr=${transaction.id}`;
    return {
      method: methodValue,
      transactionId: transaction.id,
      amountPaise: transaction.amountPaise,
      qrValue: upiUri,
      upiUri,
      counterQrValue: qrValue,
    };
  }

  if (transaction.razorpayOrderId) {
    return {
      method: methodValue,
      transactionId: transaction.id,
      amountPaise: transaction.amountPaise,
      razorpayKey: keyId,
      razorpayOrderId: transaction.razorpayOrderId,
    };
  }

  let orderResponse: Response;
  try {
    orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: transaction.amountPaise,
        currency: "INR",
        receipt: transaction.id,
        notes: { transaction_id: transaction.id, module: moduleValue },
      }),
      cache: "no-store",
    });
  } catch {
    return { error: "Razorpay could not be reached. No payment has been taken; try again." };
  }
  if (!orderResponse.ok) {
    return { error: `Razorpay order creation failed (${orderResponse.status}). No payment has been taken.` };
  }
  const order = (await orderResponse.json()) as { id?: string; amount?: number; currency?: string };
  if (order.amount !== transaction.amountPaise || order.currency !== "INR" || !order.id) {
    return { error: "Razorpay returned an order that did not match the requested amount." };
  }

  const { setRazorpayOrder } = await import("@/lib/data/payments");
  const attached = await setRazorpayOrder(profile, transaction.id, order.id);
  if (!attached.ok) return { error: attached.error };

  return {
    method: methodValue,
    transactionId: transaction.id,
    amountPaise: transaction.amountPaise,
    razorpayKey: keyId,
    razorpayOrderId: order.id,
  };
}

export async function verifyCounterPaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const profile = await requireProfile();
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { error: "Only authorized counter staff can verify payments." };
  }
  const qr = String(formData.get("qr") ?? "").trim();
  const match = /^unisync-pay:\/\/([\da-f-]{36})\/([\da-f]{64})$/i.exec(qr);
  if (!match) return { error: "Scan or enter a valid UniSync payment QR." };

  const method = String(formData.get("method") ?? "");
  if (method !== "upi" && method !== "cash") return { error: "Choose Cash or UPI verification." };
  const reference = String(formData.get("reference") ?? "").trim();
  if (reference.length > 80) return { error: "The UPI transaction reference is too long." };
  const result = await verifyCounterPayment(
    profile,
    match[1],
    method,
    createHash("sha256").update(match[2]).digest("hex"),
    method === "upi" ? reference : null,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/printpulse");
  revalidatePath("/printpulse/[id]", "page");
  revalidatePath("/ecafe");
  revalidatePath("/ecafe/order/[id]", "page");
  revalidatePath("/ecafe/counter");
  return { success: "Payment verified. The order is now released to its queue." };
}

export async function verifyRazorpayCheckoutAction(formData: FormData) {
  const profile = await requireProfile();
  const transactionId = String(formData.get("transaction_id") ?? "");
  const orderId = String(formData.get("razorpay_order_id") ?? "");
  const paymentId = String(formData.get("razorpay_payment_id") ?? "");
  const signature = String(formData.get("razorpay_signature") ?? "");
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !transactionId || !orderId || !paymentId || !signature) {
    return { error: "Razorpay verification details are incomplete." };
  }

  const transaction = await getRazorpayTransaction(transactionId);
  if (
    !transaction ||
    transaction.user_id !== profile.id ||
    transaction.status !== "pending" ||
    transaction.razorpay_order_id !== orderId
  ) {
    return { error: "The payment does not match your pending order." };
  }

  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!timingSafeHexEqual(expected, signature)) return { error: "Razorpay signature verification failed." };

  let paymentResponse: Response;
  try {
    paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${secret}`).toString("base64")}`,
      },
      cache: "no-store",
    });
  } catch {
    return { error: "Could not reach Razorpay to confirm payment status. The queue remains locked." };
  }
  if (!paymentResponse.ok) return { error: "Could not confirm payment status with Razorpay." };
  const payment = (await paymentResponse.json()) as {
    status?: string;
    order_id?: string;
    amount?: number;
    currency?: string;
    id?: string;
  };
  if (
    payment.status !== "captured" ||
    payment.order_id !== orderId ||
    payment.amount !== transaction.amount_paise ||
    payment.currency !== "INR" ||
    payment.id !== paymentId
  ) {
    return { error: "Razorpay has not captured the exact order amount yet. The queue remains locked." };
  }

  const settled = await settleVerifiedRazorpayPayment({
    transactionId,
    orderId,
    paymentId,
    amountPaise: payment.amount,
    currency: payment.currency,
  });
  if (!settled.ok) return { error: settled.error };
  revalidatePath("/printpulse");
  revalidatePath("/printpulse/[id]", "page");
  revalidatePath("/ecafe");
  revalidatePath("/ecafe/order/[id]", "page");
  return { success: "Payment verified and the order has been released to its queue." };
}
