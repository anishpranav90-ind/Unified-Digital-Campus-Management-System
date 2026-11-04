import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MAX_WEBHOOK_BYTES = 1_000_000;
const SUPPORTED_EVENTS = new Set([
  "payment.authorized",
  "payment.captured",
  "payment.failed",
  "order.paid",
]);

type JsonRecord = Record<string, unknown>;

export type RazorpayWebhookEvent = {
  eventId: string;
  eventType: "payment.authorized" | "payment.captured" | "payment.failed" | "order.paid";
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency: "INR";
  paymentStatus: "authorized" | "captured" | "failed" | "paid";
  eventCreatedAt: string;
  failureCode: string | null;
};

type WebhookDependencies = {
  secret: string | undefined;
  processEvent: (event: RazorpayWebhookEvent) => Promise<"processed" | "duplicate" | "already_paid">;
};

export class RazorpayWebhookProcessingError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "RazorpayWebhookProcessingError";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getEntity(event: JsonRecord, entityType: "payment" | "order") {
  const payload = event.payload;
  if (!isRecord(payload)) return null;
  const resource = payload[entityType];
  if (!isRecord(resource) || !isRecord(resource.entity)) return null;
  return resource.entity;
}

function requiredString(entity: JsonRecord, key: string) {
  const value = entity[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function verifySignature(rawBody: Buffer, signature: string | null, secret: string) {
  if (!signature || !/^[\da-f]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function parseEvent(rawBody: Buffer, signatureEventId: string | null): RazorpayWebhookEvent | null {
  let envelope: unknown;
  try {
    envelope = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new RazorpayWebhookProcessingError("Webhook payload is not valid JSON.", "INVALID_JSON");
  }
  if (!isRecord(envelope) || typeof envelope.event !== "string") {
    throw new RazorpayWebhookProcessingError("Webhook event is missing.", "INVALID_EVENT");
  }
  if (!SUPPORTED_EVENTS.has(envelope.event)) return null;
  if (!isPositiveInteger(envelope.created_at)) {
    throw new RazorpayWebhookProcessingError("Webhook event timestamp is invalid.", "INVALID_EVENT");
  }

  const eventId =
    signatureEventId && signatureEventId.length <= 255
      ? signatureEventId
      : createHash("sha256").update(rawBody).digest("hex");
  const eventCreatedAt = new Date(envelope.created_at * 1000);
  if (!Number.isFinite(eventCreatedAt.getTime())) {
    throw new RazorpayWebhookProcessingError("Webhook event timestamp is invalid.", "INVALID_EVENT");
  }

  if (envelope.event === "order.paid") {
    const order = getEntity(envelope, "order");
    const payment = getEntity(envelope, "payment");
    if (
      !order ||
      !payment ||
      order.status !== "paid" ||
      !isPositiveInteger(order.amount_paid) ||
      order.currency !== "INR"
    ) {
      throw new RazorpayWebhookProcessingError("Paid order details are incomplete.", "INVALID_EVENT");
    }
    const orderId = requiredString(order, "id");
    const paymentId = requiredString(payment, "id");
    if (
      !orderId ||
      !paymentId ||
      payment.order_id !== orderId ||
      (payment.amount !== undefined && payment.amount !== order.amount_paid) ||
      (payment.currency !== undefined && payment.currency !== "INR")
    ) {
      throw new RazorpayWebhookProcessingError("Paid order identifiers do not match.", "INVALID_EVENT");
    }
    return {
      eventId,
      eventType: "order.paid",
      orderId,
      paymentId,
      amountPaise: order.amount_paid,
      currency: "INR",
      paymentStatus: "paid",
      eventCreatedAt: eventCreatedAt.toISOString(),
      failureCode: null,
    };
  }

  const payment = getEntity(envelope, "payment");
  const expectedStatus =
    envelope.event === "payment.authorized"
      ? "authorized"
      : envelope.event === "payment.captured"
        ? "captured"
        : "failed";
  if (
    !payment ||
    payment.status !== expectedStatus ||
    !isPositiveInteger(payment.amount) ||
    payment.currency !== "INR"
  ) {
    throw new RazorpayWebhookProcessingError("Payment details do not match the webhook event.", "INVALID_EVENT");
  }
  const orderId = requiredString(payment, "order_id");
  const paymentId = requiredString(payment, "id");
  if (!orderId || !paymentId) {
    throw new RazorpayWebhookProcessingError("Payment identifiers are incomplete.", "INVALID_EVENT");
  }

  const failureCode = payment.error_code;
  return {
    eventId,
    eventType: envelope.event as RazorpayWebhookEvent["eventType"],
    orderId,
    paymentId,
    amountPaise: payment.amount,
    currency: "INR",
    paymentStatus: expectedStatus,
    eventCreatedAt: eventCreatedAt.toISOString(),
    failureCode:
      expectedStatus === "failed" && typeof failureCode === "string"
        ? failureCode.slice(0, 100)
        : null,
  };
}

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status });
}

export function createRazorpayWebhookHandler(dependencies: WebhookDependencies) {
  return async function POST(request: Request) {
    if (!dependencies.secret) {
      return json({ error: "Razorpay webhook is not configured." }, 503);
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_WEBHOOK_BYTES) {
      return json({ error: "Webhook payload is too large." }, 413);
    }

    let rawBody: Buffer;
    try {
      rawBody = Buffer.from(await request.arrayBuffer());
    } catch {
      return json({ error: "Could not read webhook payload." }, 400);
    }
    if (rawBody.length === 0 || rawBody.length > MAX_WEBHOOK_BYTES) {
      return json({ error: "Webhook payload is empty or too large." }, 400);
    }

    if (!verifySignature(rawBody, request.headers.get("x-razorpay-signature"), dependencies.secret)) {
      return json({ error: "Webhook signature verification failed." }, 400);
    }

    let event: RazorpayWebhookEvent | null;
    try {
      event = parseEvent(rawBody, request.headers.get("x-razorpay-event-id"));
    } catch (error) {
      if (error instanceof RazorpayWebhookProcessingError) {
        return json({ error: error.message }, 400);
      }
      return json({ error: "Could not parse webhook payload." }, 400);
    }
    if (!event) return json({ received: true, ignored: true }, 200);

    try {
      const result = await dependencies.processEvent(event);
      return json({ received: true, result }, 200);
    } catch (error) {
      const code =
        error instanceof RazorpayWebhookProcessingError
          ? error.code
          : typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : undefined;
      if (code === "P0002") return json({ error: "Payment transaction not found." }, 404);
      if (code === "22023") return json({ error: "Webhook payment validation failed." }, 400);
      if (code === "CONFIG") return json({ error: "Payment settlement is not configured." }, 503);
      return json({ error: "Webhook payment processing failed." }, 500);
    }
  };
}
