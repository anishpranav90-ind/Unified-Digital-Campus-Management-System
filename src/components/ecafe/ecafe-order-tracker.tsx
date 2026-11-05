import Link from "next/link";
import { ArrowUpRight, Check, Clock3 } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { EcafeOrderStatus } from "@/types";

const ORDER_STEPS = [
  { status: "PAYMENT_PENDING", label: "Payment", detail: "Payment must be verified before kitchen preparation." },
  { status: "QUEUED", label: "Queued", detail: "Your paid order is waiting for the kitchen." },
  { status: "PREPARING", label: "Preparing", detail: "The kitchen is preparing your order." },
  { status: "READY", label: "Ready", detail: "Collect your order at Window B." },
  { status: "COMPLETED", label: "Collected", detail: "Your order has been handed over." },
] as const;

const ACTIVE_STEP: Partial<Record<EcafeOrderStatus, number>> = {
  PAYMENT_PENDING: 0,
  VERIFIED_AND_QUEUED: 1,
  QUEUED: 1,
  PREPARING: 2,
  READY: 3,
  COMPLETED: 4,
};

export function EcafeOrderTracker({
  orderNumber,
  status,
  tokenNumber,
}: {
  orderNumber: string;
  status: EcafeOrderStatus;
  tokenNumber: number | null;
}) {
  if (status === "CANCELLED") {
    return (
      <Card className="border-red-200 bg-red-50 p-5">
        <p className="text-sm font-bold text-red-900">Order cancelled</p>
        <p className="mt-1 text-xs text-red-800">
          {orderNumber} is no longer in the kitchen queue. Contact cafe staff if you need help.
        </p>
      </Card>
    );
  }

  const activeStep = ACTIVE_STEP[status] ?? 0;
  const step = ORDER_STEPS[activeStep];
  const paymentPending = status === "PAYMENT_PENDING";
  const ready = status === "READY";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Live order tracker</p>
          <h2 className="mt-1 text-sm font-bold text-ink">
            {tokenNumber !== null ? `Token #${String(tokenNumber).padStart(3, "0")}` : orderNumber}
          </h2>
          <p className="mt-1 text-xs text-muted">{step.detail}</p>
        </div>
        <Badge tone={paymentPending ? "amber" : ready || status === "COMPLETED" ? "green" : "blue"}>
          {paymentPending ? "PAYMENT PENDING" : step.label.toUpperCase()}
        </Badge>
      </div>

      <ol className="grid gap-3 p-5 sm:grid-cols-5" aria-label="Order progress">
        {ORDER_STEPS.map((item, index) => {
          const complete = index < activeStep;
          const current = index === activeStep;
          return (
            <li
              key={item.status}
              aria-current={current ? "step" : undefined}
              className="flex items-center gap-2 sm:flex-col sm:items-start"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  complete
                    ? "bg-emerald-600 text-white"
                    : current
                      ? paymentPending
                        ? "bg-amber-500 text-white ring-4 ring-amber-100"
                        : "bg-brand-blue text-white ring-4 ring-blue-100"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {complete ? <Check className="h-4 w-4" /> : current ? <Clock3 className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={`text-[11px] font-medium ${complete || current ? "text-ink" : "text-slate-400"}`}>
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas px-5 py-3">
        <p className="text-[10px] text-muted">
          {paymentPending
            ? "After payment verification, your token will appear in the live kitchen queue."
            : "Order status updates automatically as cafe staff process it."}
        </p>
        {tokenNumber !== null ? (
          <Link
            href="/ecafe/board"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
          >
            View kitchen board <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
