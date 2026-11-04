"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Banknote, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, Card, CardHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { verifyPrintPaymentAction } from "@/lib/actions/printpulse";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { PrintRequest } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useActionState } from "react";

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { email: string; contact?: string };
  method: { upi: boolean };
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export function PrintPaymentPanel({
  request,
  isStaff,
  razorpayKeyId,
  appUrl,
}: {
  request: PrintRequest;
  isStaff: boolean;
  razorpayKeyId: string;
  appUrl: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(verifyPrintPaymentAction, EMPTY_FORM_STATE);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const isPending = request.payment_status === "unpaid";
  const isUpi = request.payment_method === "upi";
  const requestUrl = new URL(`/printpulse/${request.id}`, appUrl).toString();
  const razorpayConfigured = Boolean(razorpayKeyId);

  async function startRazorpayCheckout() {
    if (!checkoutReady || !window.Razorpay || checkoutBusy) return;
    setCheckoutError("");
    setCheckoutBusy(true);
    try {
      const orderResponse = await fetch(`/api/printpulse/${request.id}/razorpay-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const order = (await orderResponse.json()) as {
        error?: string;
        keyId?: string;
        orderId?: string;
        amount?: number;
        currency?: string;
        name?: string;
        description?: string;
        email?: string;
        contact?: string;
      };
      if (!orderResponse.ok || !order.keyId || !order.orderId || !order.amount || !order.currency) {
        throw new Error(order.error ?? "Could not start Razorpay checkout.");
      }

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.name ?? "UniSync PrintPulse",
        description: order.description ?? `Print request ${request.request_number}`,
        prefill: { email: order.email ?? "", ...(order.contact ? { contact: order.contact } : {}) },
        method: { upi: true },
        theme: { color: "#f97316" },
        modal: { ondismiss: () => setCheckoutBusy(false) },
        handler: (response) => {
          void verifyPayment(response);
        },
      });
      checkout.open();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start Razorpay checkout.");
      setCheckoutBusy(false);
    }
  }

  async function verifyPayment(payment: RazorpaySuccess) {
    setCheckoutError("");
    try {
      const response = await fetch(`/api/printpulse/${request.id}/razorpay-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not verify the payment.");
      router.refresh();
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Payment may have succeeded but could not be verified. Contact the print desk before paying again.",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <>
      {isPending && isUpi && razorpayConfigured ? (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onReady={() => setCheckoutReady(true)}
          onError={() => setCheckoutError("Razorpay Checkout could not load. Check your connection and retry.")}
        />
      ) : null}
      <Card>
        <CardHeader
          title={isPending ? "Payment pending verification" : "Payment & bill"}
          description={`Request ${request.request_number} · ${formatCurrency(request.estimated_cost)}`}
          icon={isPending ? <CreditCard className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          action={
            <Badge tone={request.payment_status === "paid" ? "green" : isPending ? "amber" : "slate"}>
              {request.payment_status === "paid"
                ? "Verified"
                : isPending
                  ? "Pending"
                  : request.payment_status.replace("_", " ")}
            </Badge>
          }
        />

        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              {isUpi ? <CreditCard className="h-4 w-4 text-brand-orange" /> : <Banknote className="h-4 w-4 text-emerald-700" />}
              {isUpi ? "GPay / UPI via Razorpay" : request.payment_method === "cash" ? "Cash at counter" : "Legacy payment"}
            </p>
            {isPending ? (
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {isUpi
                  ? razorpayConfigured
                    ? "Pay the exact bill securely through Razorpay. UPI apps open on mobile; desktop checkout offers a QR to scan with GPay or another UPI app. Your file is released after Razorpay confirms payment."
                    : "Razorpay is not configured. Contact the campus administrator to enable online payments."
                  : "Show the request QR at the print desk. Staff scan it, collect cash and confirm the bill before your file enters the queue."}
              </p>
            ) : request.payment_status === "paid" ? (
              <>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Payment verified by Razorpay or print desk staff. Your request is queued; the QR links to this digital bill and job status.
                </p>
                {request.payment_reference ? (
                  <p className="mt-2 text-[10px] text-muted">Payment reference: {request.payment_reference}</p>
                ) : null}
                <Button className="mt-3" size="sm" variant="secondary" onClick={() => window.print()}>
                  Print bill
                </Button>
              </>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-muted">
                This request predates guarded payment processing. New requests require payment verification before printing.
              </p>
            )}

            {isPending && isUpi && !isStaff && razorpayConfigured ? (
              <div className="mt-4">
                <Button onClick={startRazorpayCheckout} disabled={!checkoutReady || checkoutBusy}>
                  {checkoutBusy ? "Waiting for payment…" : checkoutReady ? "Pay with GPay / UPI" : "Loading secure checkout…"}
                </Button>
                {checkoutError ? <Alert className="mt-3" tone="error">{checkoutError}</Alert> : null}
              </div>
            ) : null}

            {isStaff && isPending ? (
              <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" /> Staff verification
                </p>
                {isUpi ? (
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">
                    UPI payments are verified automatically through Razorpay. Do not mark an online payment paid from this screen.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">
                      Scan the cash request QR, confirm the request number and amount, then record the cash collected.
                    </p>
                    <form action={formAction} className="mt-3 space-y-3">
                      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
                      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="payment_method" value="cash" />
                      <SubmitButton size="sm" variant="success" pendingText="Verifying…">
                        Confirm cash collected &amp; queue job
                      </SubmitButton>
                    </form>
                  </>
                )}
              </div>
            ) : null}
          </div>

          <div className="justify-self-center rounded-xl border border-line bg-white p-2">
            {isUpi && isPending ? (
              <div className="flex h-44 w-44 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted">
                <CreditCard className="h-7 w-7 text-brand-orange" />
                {razorpayConfigured
                  ? "Open Razorpay Checkout to get a UPI QR on desktop or launch a UPI app on mobile."
                  : "UPI checkout is unavailable until Razorpay is configured."}
              </div>
            ) : (
              <QRCodeSVG
                value={requestUrl}
                size={176}
                level="M"
                title={isPending ? "Cash bill and verification request QR" : "Digital print bill QR"}
              />
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
