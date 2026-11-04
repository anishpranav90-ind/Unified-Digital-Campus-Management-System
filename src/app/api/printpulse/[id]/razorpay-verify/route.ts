import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRazorpayPayment, verifyRazorpayCheckoutSignature } from "@/lib/razorpay";
import { markRazorpayPrintPaymentPaid } from "@/lib/data/razorpay-print";

const BodySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to verify payment." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid Razorpay payment details." }, { status: 400 });
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });

  const { data: order, error: orderError } = await admin
    .from("print_payment_orders")
    .select("provider_order_id, print_request_id, student_id, amount_paise, status")
    .eq("provider_order_id", body.data.razorpay_order_id)
    .eq("print_request_id", id)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: "Could not verify the payment order." }, { status: 500 });
  if (!order || order.student_id !== profile.id) {
    return NextResponse.json({ error: "This payment order does not belong to your print request." }, { status: 403 });
  }
  if (!verifyRazorpayCheckoutSignature(
    body.data.razorpay_order_id,
    body.data.razorpay_payment_id,
    body.data.razorpay_signature,
  )) {
    return NextResponse.json({ error: "Razorpay payment signature is invalid." }, { status: 400 });
  }

  let payment;
  try {
    payment = await getRazorpayPayment(body.data.razorpay_payment_id);
  } catch (error) {
    console.error("Razorpay payment verification failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not verify this payment." },
      { status: 502 },
    );
  }
  if (
    payment.order_id !== order.provider_order_id ||
    payment.amount !== Number(order.amount_paise) ||
    payment.currency !== "INR"
  ) {
    return NextResponse.json({ error: "Payment details do not match the print bill." }, { status: 400 });
  }
  if (payment.status !== "captured") {
    return NextResponse.json({ error: "Payment is not captured yet. Wait for confirmation and retry." }, { status: 409 });
  }

  const result = await markRazorpayPrintPaymentPaid(
    order.provider_order_id,
    payment.id,
    payment.amount,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  const supabase = await createSupabaseServerClient();
  const { data: requestRow } = await supabase
    .from("print_requests")
    .select("request_number")
    .eq("id", result.requestId)
    .maybeSingle();
  return NextResponse.json({ ok: true, requestId: result.requestId, requestNumber: requestRow?.request_number });
}
