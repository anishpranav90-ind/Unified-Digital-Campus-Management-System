"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Alert, Button } from "@/components/ui";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import {
  startPaymentAction,
  verifyRazorpayCheckoutAction,
  type PaymentActionState,
} from "@/lib/actions/payments";
import type { PaymentMethod } from "@/types";
import { formatCurrency } from "@/lib/utils";

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded."));
    document.body.appendChild(script);
  });
}

export function PaymentSelection({
  module,
  entityId,
  amountPaise,
  orderNumber,
  allowedMethods,
}: {
  module: "printpulse" | "ecafe";
  entityId: string;
  amountPaise: number;
  orderNumber: string;
  allowedMethods?: PaymentMethod[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<PaymentActionState, FormData>(
    startPaymentAction,
    EMPTY_FORM_STATE,
  );
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutPending, setCheckoutPending] = useState(false);

  async function openRazorpay() {
    if (!state.razorpayKey || !state.razorpayOrderId || !state.transactionId) return;
    setCheckoutError("");
    setCheckoutPending(true);
    try {
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay checkout did not initialize.");
      const checkout = new window.Razorpay({
        key: state.razorpayKey,
        amount: state.amountPaise ?? amountPaise,
        currency: "INR",
        name: "UniSync",
        description: `${module === "ecafe" ? "e-Cafe" : "PrintPulse"} · ${orderNumber}`,
        order_id: state.razorpayOrderId,
        handler: async (response) => {
          setCheckoutPending(true);
          const formData = new FormData();
          formData.set("transaction_id", state.transactionId!);
          formData.set("razorpay_order_id", response.razorpay_order_id);
          formData.set("razorpay_payment_id", response.razorpay_payment_id);
          formData.set("razorpay_signature", response.razorpay_signature);
          const result = await verifyRazorpayCheckoutAction(formData);
          if (result.error) {
            setCheckoutError(result.error);
            setCheckoutPending(false);
            return;
          }
          router.refresh();
        },
      });
      checkout.open();
      setCheckoutPending(false);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not open Razorpay checkout.");
      setCheckoutPending(false);
    }
  }

  const allMethods: { value: PaymentMethod; label: string; detail: string }[] = [
    { value: "upi", label: "UPI / GPay / PhonePe", detail: "Scan a pre-filled UPI QR code." },
    { value: "razorpay", label: "Razorpay", detail: "UPI apps, cards and netbanking." },
    { value: "cash", label: "Cash at counter", detail: "Pay a staff member and show the order QR." },
  ];
  const methods = allMethods.filter((method) => !allowedMethods || allowedMethods.includes(method.value));

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <div>
        <h2 className="text-sm font-semibold text-ink">Choose payment method</h2>
        <p className="mt-1 text-xs text-muted">
          Amount due: <span className="font-semibold text-ink">{formatCurrency(amountPaise / 100)}</span>
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {methods.map((method) => (
          <form action={formAction} key={method.value}>
            <input type="hidden" name="module" value={module} />
            <input type="hidden" name="entity_id" value={entityId} />
            <input type="hidden" name="method" value={method.value} />
            <button
              type="submit"
              disabled={pending || checkoutPending}
              className="focus-ring h-full w-full rounded-xl border border-line p-3 text-left transition-colors hover:border-brand-blue hover:bg-blue-50/50 disabled:opacity-60"
            >
              <span className="block text-xs font-semibold text-ink">{method.label}</span>
              <span className="mt-1 block text-[10px] text-muted">{method.detail}</span>
            </button>
          </form>
        ))}
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {checkoutError ? <Alert tone="error">{checkoutError}</Alert> : null}

      {state.method && state.transactionId ? (
        <div className="grid gap-4 rounded-xl border border-line bg-canvas p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink">
              {state.method === "cash"
                ? "Show this authorization QR to counter staff after paying cash."
                : state.method === "upi"
                  ? "Scan the UPI QR in your payment app. Staff must verify the payment before the order is released."
                  : "Complete payment in Razorpay Checkout. The order is released only after server verification."}
            </p>
            {state.method === "upi" && state.counterQrValue ? (
              <div>
                <p className="mb-1 text-[10px] font-medium text-muted">Counter verification QR (show staff after paying)</p>
                <QRCodeSVG value={state.counterQrValue} size={132} level="M" includeMargin />
              </div>
            ) : null}
            {state.method === "razorpay" ? (
              <Button
                type="button"
                size="sm"
                variant="accent"
                disabled={checkoutPending}
                onClick={openRazorpay}
              >
                {checkoutPending ? "Verifying payment…" : "Open Razorpay Checkout"}
              </Button>
            ) : null}
            <p className="break-all font-mono text-[10px] text-muted">Reference: {state.transactionId}</p>
          </div>
          {state.qrValue ? (
            <div className="space-y-2">
              <QRCodeSVG value={state.qrValue} size={164} level="M" includeMargin />
              {state.method === "upi" ? (
                <a
                  href={state.upiUri}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-brand-blue px-3 py-2 text-xs font-semibold text-white sm:hidden"
                >
                  Open UPI app
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-[10px] text-muted">
        A QR scan or client-side success screen is not proof of payment. Print and kitchen queues remain locked until
        server verification or counter confirmation.
      </p>
    </section>
  );
}
