import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { settleVerifiedRazorpayPayment } from "@/lib/data/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-razorpay-signature");
  if (!secret || !signature || !/^[\da-f]{64}$/i.test(signature)) {
    return NextResponse.json({ error: "Webhook signature is missing or invalid." }, { status: 400 });
  }

  const rawBody = await request.text();
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return NextResponse.json({ error: "Webhook signature verification failed." }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          amount?: number;
          currency?: string;
          status?: string;
        };
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Webhook payload is not valid JSON." }, { status: 400 });
  }

  if (event.event !== "payment.captured") return NextResponse.json({ received: true });
  const payment = event.payload?.payment?.entity;
  if (
    !payment?.id ||
    !payment.order_id ||
    !Number.isInteger(payment.amount) ||
    payment.status !== "captured"
  ) {
    return NextResponse.json({ error: "Captured payment details are incomplete." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Payment settlement is not configured." }, { status: 503 });
  const { data: transaction, error } = await admin
    .from("payment_transactions")
    .select("id, status, razorpay_payment_id")
    .eq("razorpay_order_id", payment.order_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not look up the payment order." }, { status: 500 });
  if (!transaction) return NextResponse.json({ error: "Payment order not found." }, { status: 404 });
  if (transaction.status === "verified") {
    if (transaction.razorpay_payment_id === payment.id) return NextResponse.json({ received: true });
    return NextResponse.json({ error: "Payment order was already settled with a different payment." }, { status: 409 });
  }

  const result = await settleVerifiedRazorpayPayment({
    transactionId: transaction.id,
    orderId: payment.order_id,
    paymentId: payment.id,
    amountPaise: payment.amount!,
    currency: payment.currency ?? "",
  });
  if (!result.ok) {
    console.error("Razorpay webhook settlement failed", result.error);
    return NextResponse.json({ error: "Payment could not be settled." }, { status: 409 });
  }
  return NextResponse.json({ received: true });
}
