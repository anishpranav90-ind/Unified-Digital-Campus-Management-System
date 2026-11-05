"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
import { QrScanner } from "@/components/payments/qr-scanner";
import { formatCurrency } from "@/lib/utils";
import type { EcafeOrderItem } from "@/types";

type PendingOrder = {
  order_number: string;
  items: EcafeOrderItem[];
  amount_paise: number;
};

type VerificationResponse = {
  order?: PendingOrder;
  error?: string;
  success?: boolean;
  orderNumber?: string;
};

const CASH_PAYMENT_QR = /^unisync-pay:\/\/([\da-f-]{36})\/([\da-f]{64})$/i;

export function CashierVerification() {
  const [qr, setQr] = useState("");
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmedQr = useRef("");
  const router = useRouter();

  function changeQr(value: string) {
    setQr(value);
    setOrder(null);
    setError("");
    setSuccess("");
    setLoadingPreview(CASH_PAYMENT_QR.test(value.trim()));
  }

  function handleScan(value: string) {
    const scannedQr = value.trim();
    if (confirming || scannedQr === qr.trim() || scannedQr === confirmedQr.current) return;
    changeQr(value);
  }

  useEffect(() => {
    if (!CASH_PAYMENT_QR.test(qr.trim())) return;
    const controller = new AbortController();
    void fetch("/api/orders/verify-cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", qr: qr.trim() }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as VerificationResponse;
        if (!response.ok) throw new Error(result.error ?? "Could not load this cash order.");
        if (!controller.signal.aborted) setOrder(result.order ?? null);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load this cash order.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPreview(false);
      });

    return () => controller.abort();
  }, [qr]);

  async function confirmCashReceived() {
    setConfirming(true);
    setError("");
    try {
      const response = await fetch("/api/orders/verify-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", qr: qr.trim() }),
      });
      const result = (await response.json()) as VerificationResponse;
      if (!response.ok) throw new Error(result.error ?? "Could not confirm cash receipt.");
      confirmedQr.current = qr.trim();
      setSuccess(`${result.orderNumber ?? order?.order_number ?? "Order"} payment received and sent to the kitchen.`);
      setQr("");
      setOrder(null);
      setLoadingPreview(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm cash receipt.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      <QrScanner onScan={handleScan} />
      <Field label="Student payment QR" htmlFor="cashier-qr">
        <Input
          id="cashier-qr"
          value={qr}
          disabled={confirming}
          onChange={(event) => changeQr(event.target.value)}
          placeholder="Scan or paste the student's cash authorization QR"
          autoComplete="off"
        />
      </Field>
      {loadingPreview ? <p className="text-xs text-muted">Loading pending order…</p> : null}
      {order ? (
        <section className="space-y-3 rounded-xl border border-line bg-canvas p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-ink">{order.order_number}</h2>
            <span className="text-sm font-bold text-ink">{formatCurrency(order.amount_paise / 100)}</span>
          </div>
          <ul className="divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-2 text-xs">
                <span className="text-ink">{item.quantity} × {item.name}</span>
                <span className="font-medium text-ink">
                  {formatCurrency((item.quantity * item.unit_price_paise) / 100)}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-line pt-3 text-sm font-bold text-ink">
            <span>Exact amount due</span>
            <span>{formatCurrency(order.amount_paise / 100)}</span>
          </p>
          <Button type="button" variant="accent" disabled={confirming} onClick={confirmCashReceived}>
            {confirming ? "Confirming…" : "Confirm Payment Received"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
