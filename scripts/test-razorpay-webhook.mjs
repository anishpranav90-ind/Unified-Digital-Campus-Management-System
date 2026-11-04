import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/payments/razorpay-webhook.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const webhook = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const secret = "local-webhook-test-secret";

function paymentPayload(event, overrides = {}) {
  const status =
    event === "payment.authorized"
      ? "authorized"
      : event === "payment.failed"
        ? "failed"
        : "captured";
  return {
    created_at: 1_798_000_000,
    event,
    payload: {
      payment: {
        entity: {
          id: "pay_test_123",
          order_id: "order_test_123",
          amount: 15500,
          currency: "INR",
          status,
          ...overrides,
        },
      },
    },
  };
}

function signedRequest(payload, { signatureBody, eventId = "evt_test_123", signature } = {}) {
  const body = JSON.stringify(payload);
  const signedBody = signatureBody ?? body;
  const digest = signature ?? createHmac("sha256", secret).update(signedBody).digest("hex");
  return new Request("https://unisync.test/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": digest,
      ...(eventId ? { "x-razorpay-event-id": eventId } : {}),
    },
    body,
  });
}

function handler(processEvent, configuredSecret = secret) {
  return webhook.createRazorpayWebhookHandler({ secret: configuredSecret, processEvent });
}

test("valid payment.captured passes validated fields to atomic processor", async () => {
  let processed;
  const response = await handler(async (event) => {
    processed = event;
    return "processed";
  })(signedRequest(paymentPayload("payment.captured")));
  assert.equal(response.status, 200);
  assert.equal(processed.eventType, "payment.captured");
  assert.equal(processed.paymentStatus, "captured");
  assert.equal(processed.amountPaise, 15500);
});

test("valid order.paid is normalized as a paid event", async () => {
  let processed;
  const payload = {
    created_at: 1_798_000_000,
    event: "order.paid",
    payload: {
      order: { entity: { id: "order_test_123", status: "paid", amount_paid: 15500, currency: "INR" } },
      payment: {
        entity: {
          id: "pay_test_123",
          order_id: "order_test_123",
          amount: 15500,
          currency: "INR",
        },
      },
    },
  };
  const response = await handler(async (event) => {
    processed = event;
    return "processed";
  })(signedRequest(payload));
  assert.equal(response.status, 200);
  assert.equal(processed.eventType, "order.paid");
  assert.equal(processed.paymentStatus, "paid");
});

test("payment.failed is recorded without promoting it to paid", async () => {
  let processed;
  const response = await handler(async (event) => {
    processed = event;
    return "processed";
  })(signedRequest(paymentPayload("payment.failed", { error_code: "BAD_REQUEST_ERROR" })));
  assert.equal(response.status, 200);
  assert.equal(processed.paymentStatus, "failed");
  assert.equal(processed.failureCode, "BAD_REQUEST_ERROR");
});

test("payment.authorized is separate from captured", async () => {
  let processed;
  const response = await handler(async (event) => {
    processed = event;
    return "processed";
  })(signedRequest(paymentPayload("payment.authorized")));
  assert.equal(response.status, 200);
  assert.equal(processed.paymentStatus, "authorized");
});

test("invalid signature is rejected before database processing", async () => {
  let called = false;
  const response = await handler(async () => {
    called = true;
    return "processed";
  })(signedRequest(paymentPayload("payment.captured"), { signature: "0".repeat(64) }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("duplicate events are safely acknowledged", async () => {
  const response = await handler(async () => "duplicate")(
    signedRequest(paymentPayload("payment.captured")),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result, "duplicate");
});

test("missing webhook secret reports configuration error", async () => {
  const response = await handler(async () => "processed", null)(
    signedRequest(paymentPayload("payment.captured")),
  );
  assert.equal(response.status, 503);
});

test("unknown signed events are acknowledged without database access", async () => {
  let called = false;
  const response = await handler(async () => {
    called = true;
    return "processed";
  })(signedRequest({ created_at: 1_798_000_000, event: "settlement.processed", payload: {} }));
  assert.equal(response.status, 200);
  assert.equal(called, false);
});

test("missing payment transaction maps to not found", async () => {
  const response = await handler(async () => {
    throw new webhook.RazorpayWebhookProcessingError("missing", "P0002");
  })(signedRequest(paymentPayload("payment.captured")));
  assert.equal(response.status, 404);
});

test("amount and currency mismatches are rejected by the database boundary", async () => {
  for (const payload of [
    paymentPayload("payment.captured", { amount: 15000 }),
    paymentPayload("payment.captured", { currency: "USD" }),
  ]) {
    const response = await handler(async () => {
      throw new webhook.RazorpayWebhookProcessingError("mismatch", "22023");
    })(signedRequest(payload));
    assert.equal(response.status, 400);
  }
});

test("signature is checked against exact raw bytes before JSON parsing", async () => {
  const payload = paymentPayload("payment.captured");
  const response = await handler(async () => "processed")(
    signedRequest(payload, { signatureBody: "different raw body" }),
  );
  assert.equal(response.status, 400);
});
