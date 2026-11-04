import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder, getRazorpayPublicKey } from "@/lib/razorpay";
import { isDemoMode } from "@/lib/env";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (profile.role !== "student") return NextResponse.json({ error: "Only the request owner can pay." }, { status: 403 });
  if (isDemoMode()) return NextResponse.json({ error: "Razorpay is unavailable in demo mode." }, { status: 503 });

  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const keyId = getRazorpayPublicKey();
  const admin = createSupabaseAdminClient();
  if (!keyId || !admin) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 503 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: printRequest, error: requestError } = await supabase
    .from("print_requests")
    .select("id, request_number, student_id, payment_method, payment_status, estimated_cost, status")
    .eq("id", id)
    .eq("student_id", profile.id)
    .maybeSingle();
  if (requestError) return NextResponse.json({ error: "Could not load the print request." }, { status: 500 });
  if (!printRequest) return NextResponse.json({ error: "Print request not found." }, { status: 404 });
  if (printRequest.payment_method !== "upi" || printRequest.payment_status !== "unpaid") {
    return NextResponse.json({ error: "This request is not awaiting UPI payment." }, { status: 409 });
  }
  if (!["submitted", "queued"].includes(printRequest.status)) {
    return NextResponse.json({ error: "This print request can no longer be paid." }, { status: 409 });
  }

  const amountPaise = Math.round(Number(printRequest.estimated_cost) * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return NextResponse.json({ error: "The print bill has an invalid payment amount." }, { status: 400 });
  }

  const { data: existingOrder, error: lookupError } = await admin
    .from("print_payment_orders")
    .select("provider_order_id, amount_paise, status")
    .eq("print_request_id", id)
    .eq("status", "created")
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not check the existing payment order." }, { status: 500 });
  if (existingOrder) {
    if (Number(existingOrder.amount_paise) !== amountPaise) {
      return NextResponse.json({ error: "The existing Razorpay order does not match this bill." }, { status: 409 });
    }
    return NextResponse.json({
      keyId,
      orderId: existingOrder.provider_order_id,
      amount: amountPaise,
      currency: "INR",
      name: "UniSync PrintPulse",
      description: `Print request ${printRequest.request_number}`,
      email: profile.email,
      contact: profile.phone ?? "",
    });
  }

  let order;
  try {
    order = await createRazorpayOrder(amountPaise, printRequest.request_number);
  } catch (error) {
    console.error("Could not create Razorpay print order", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start Razorpay checkout." },
      { status: 502 },
    );
  }

  const { error: saveOrderError } = await admin.from("print_payment_orders").insert({
    print_request_id: id,
    student_id: profile.id,
    provider_order_id: order.id,
    amount_paise: order.amount,
    status: "created",
  });
  if (saveOrderError) {
    const { data: concurrentOrder } = await admin
      .from("print_payment_orders")
      .select("provider_order_id, amount_paise, status")
      .eq("print_request_id", id)
      .eq("status", "created")
      .maybeSingle();
    if (concurrentOrder && Number(concurrentOrder.amount_paise) === amountPaise) {
      return NextResponse.json({
        keyId,
        orderId: concurrentOrder.provider_order_id,
        amount: amountPaise,
        currency: "INR",
        name: "UniSync PrintPulse",
        description: `Print request ${printRequest.request_number}`,
        email: profile.email,
        contact: profile.phone ?? "",
      });
    }
    console.error("Could not save Razorpay print order", saveOrderError.message);
    return NextResponse.json({ error: "Could not save the payment order. Contact the print desk." }, { status: 500 });
  }

  return NextResponse.json({
    keyId,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    name: "UniSync PrintPulse",
    description: `Print request ${printRequest.request_number}`,
    email: profile.email,
    contact: profile.phone ?? "",
  });
}
