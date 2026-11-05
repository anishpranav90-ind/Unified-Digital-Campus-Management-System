import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPendingCashEcafeOrder, hashCounterToken, verifyCounterPayment } from "@/lib/data/payments";
import { getCurrentProfile } from "@/lib/session";

type VerificationRequest = {
  action?: unknown;
  qr?: unknown;
};

function isVerificationRequest(value: unknown): value is VerificationRequest {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to verify a cash order." }, { status: 401 });
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return NextResponse.json({ error: "Only authorized cafe staff can verify cash orders." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Provide a valid cashier QR request." }, { status: 400 });
  }
  if (!isVerificationRequest(body)) {
    return NextResponse.json({ error: "Provide a valid cashier QR request." }, { status: 400 });
  }

  if (typeof body.qr !== "string") {
    return NextResponse.json({ error: "Scan or enter a valid cash payment QR." }, { status: 400 });
  }
  if (body.action !== "preview" && body.action !== "confirm") {
    return NextResponse.json({ error: "Choose whether to review or confirm the cash order." }, { status: 400 });
  }
  const match = /^unisync-pay:\/\/([\da-f-]{36})\/([\da-f]{64})$/i.exec(body.qr.trim());
  if (!match) {
    return NextResponse.json({ error: "Scan or enter a valid cash payment QR." }, { status: 400 });
  }

  const transactionId = match[1];
  const tokenHash = hashCounterToken(match[2].toLowerCase());
  const order = await getPendingCashEcafeOrder(profile, transactionId, tokenHash);
  if (!order) {
    return NextResponse.json(
      { error: "This QR is not a pending e-Cafe cash order. Refresh the student's order and try again." },
      { status: 409 },
    );
  }

  if (body.action === "preview") {
    return NextResponse.json({ order });
  }

  const result = await verifyCounterPayment(profile, transactionId, "cash", tokenHash, null);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  revalidatePath("/ecafe");
  revalidatePath("/ecafe/board");
  revalidatePath("/ecafe/order/[id]", "page");
  revalidatePath("/ecafe/counter");
  revalidatePath("/cashier");
  return NextResponse.json({ success: true, orderNumber: order.order_number });
}
