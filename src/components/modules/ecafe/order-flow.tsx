"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Coffee,
  Minus,
  Plus,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import type { CafeMenuItem } from "@/lib/data/ecafe";
import {
  createCafeReceiptLink,
  type CafeReceipt,
} from "@/lib/ecafe/receipt";
import { formatCurrency } from "@/lib/utils";

type Step = "menu" | "payment" | "upi" | "receipt";

function isValidUpiId(value: string) {
  return /^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(value);
}

function createOrderId() {
  return `EC-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function CafeOrderFlow({
  menu,
  upiId,
}: {
  menu: CafeMenuItem[];
  upiId: string;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderId, setOrderId] = useState("");
  const [receipt, setReceipt] = useState<CafeReceipt | null>(null);
  const [receiptLink, setReceiptLink] = useState("");
  const selectedItems = useMemo(
    () =>
      menu.flatMap((item) => {
        const quantity = quantities[item.id] ?? 0;
        return quantity > 0
          ? [{ ...item, quantity, lineTotal: item.price * quantity }]
          : [];
      }),
    [menu, quantities],
  );
  const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = selectedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const upiConfigured = isValidUpiId(upiId);
  const upiIntent = useMemo(() => {
    if (!upiConfigured || !orderId) return "";
    const params = new URLSearchParams({
      pa: upiId,
      pn: "UniSync E-Cafe",
      am: total.toFixed(2),
      cu: "INR",
      tn: `Cafe order ${orderId}`,
    });
    return `upi://pay?${params.toString()}`;
  }, [orderId, total, upiConfigured, upiId]);
  function setQuantity(itemId: string, quantity: number) {
    setQuantities((current) => ({ ...current, [itemId]: Math.max(0, Math.min(99, quantity)) }));
  }

  function createReceipt(paymentMethod: "cash" | "upi", id: string) {
    const nextReceipt: CafeReceipt = {
      orderId: id,
      createdAt: new Date().toISOString(),
      paymentMethod,
      paymentStatus: paymentMethod === "cash" ? "cash_due" : "upi_pending",
      items: selectedItems.map((item) => ({
        itemId: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      total,
    };
    setReceiptLink(createCafeReceiptLink(nextReceipt, window.location.origin));
    setReceipt(nextReceipt);
    setStep("receipt");
  }

  function chooseUpi() {
    const id = createOrderId();
    setOrderId(id);
    setStep("upi");
  }

  function chooseCash() {
    createReceipt("cash", createOrderId());
  }

  function finishUpi() {
    if (!orderId) return;
    createReceipt("upi", orderId);
  }

  function startNewOrder() {
    setQuantities({});
    setReceipt(null);
    setReceiptLink("");
    setOrderId("");
    setStep("menu");
  }

  if (step === "receipt" && receipt) {
    const isCash = receipt.paymentMethod === "cash";
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-5">
          <Badge tone="green"><Check className="h-3 w-3" /> Bill prepared</Badge>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Your e-cafe receipt</h1>
          <p className="mt-1 text-sm text-muted">
            Order {receipt.orderId} · {new Date(receipt.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
        <Card>
          <CardHeader
            title="Order summary"
            description={isCash ? "Cash due at the cafe counter" : "UPI transfer awaiting cafe confirmation"}
            icon={<Coffee className="h-4 w-4" />}
          />
          <div className="divide-y divide-line px-5">
            {receipt.items.map((item) => (
              <div key={item.itemId} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.name}</p>
                  <p className="text-xs text-muted">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-ink">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-4">
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="text-lg font-bold text-ink">{formatCurrency(receipt.total)}</span>
          </div>
          <div className="grid gap-5 border-t border-line p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="text-sm">
              <p className="font-semibold text-ink">{isCash ? "Payment: Cash" : "Payment: UPI"}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {isCash
                  ? "Show this bill to cafe staff and pay the total at the counter."
                  : "This app cannot verify UPI transfers. Show the payment confirmation and this bill to cafe staff."}
              </p>
            </div>
            {receiptLink ? (
              <div className="justify-self-center rounded-xl border border-line bg-white p-2">
                <QRCodeSVG value={receiptLink} size={144} level="M" title="Scan to open this e-cafe receipt" />
              </div>
            ) : null}
          </div>
        </Card>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => window.print()}>
            Print bill
          </Button>
          <Button variant="secondary" onClick={startNewOrder}>
            Start another order
          </Button>
        </div>
        <p className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          This is a local receipt preview. The app does not submit orders to the cafe or confirm payments.
        </p>
      </div>
    );
  }

  if (step === "upi") {
    return (
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => setStep("payment")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Payment options
        </Button>
        <div className="mb-5 mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange">e-cafe · payment</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Pay with UPI</h1>
          <p className="mt-1 text-sm text-muted">
            Scan with GPay or another UPI app. The amount is already filled in.
          </p>
        </div>
        <Card className="mx-auto max-w-md p-5 text-center">
          <p className="text-sm font-semibold text-ink">Pay {formatCurrency(total)}</p>
          <p className="mt-1 text-xs text-muted">{upiId} · Order {orderId}</p>
          <div className="mx-auto my-5 inline-block rounded-2xl border border-line bg-white p-3">
            <QRCodeSVG value={upiIntent} size={220} level="M" title="Scan to pay the exact e-cafe total" />
          </div>
          <a
            href={upiIntent}
            className="focus-ring mx-auto flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-medium text-white hover:bg-brand-orange-dark"
          >
            <Smartphone className="h-4 w-4" /> Open a UPI app
          </a>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Payment is not automatically verified. Continue only after completing the transfer.
          </p>
          <Button className="mt-4 w-full" onClick={finishUpi}>
            I have completed payment <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Card>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => setStep("menu")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Edit order
        </Button>
        <div className="mb-5 mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange">e-cafe · checkout</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Choose how to pay</h1>
          <p className="mt-1 text-sm text-muted">
            {itemCount} {itemCount === 1 ? "item" : "items"} · Total {formatCurrency(total)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!upiConfigured}
            onClick={chooseUpi}
            className="focus-ring rounded-2xl border border-line bg-white p-5 text-left shadow-card transition hover:border-brand-orange disabled:cursor-not-allowed disabled:opacity-65"
          >
            <span className="inline-flex rounded-xl bg-orange-50 p-2.5 text-brand-orange">
              <Smartphone className="h-5 w-5" />
            </span>
            <span className="mt-4 block text-sm font-semibold text-ink">GPay / UPI</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              Scan a QR with the exact total pre-filled.
            </span>
            {!upiConfigured ? (
              <span className="mt-3 block text-xs font-medium text-amber-700">
                Configure NEXT_PUBLIC_ECAFE_UPI_ID to enable UPI.
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={chooseCash}
            className="focus-ring rounded-2xl border border-line bg-white p-5 text-left shadow-card transition hover:border-brand-orange"
          >
            <span className="inline-flex rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </span>
            <span className="mt-4 block text-sm font-semibold text-ink">Cash at counter</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              Prepare a bill to show cafe staff and pay in person.
            </span>
          </button>
        </div>
        <Card className="mt-4 flex items-center justify-between p-4">
          <span className="text-sm text-muted">Total due</span>
          <span className="text-lg font-bold text-ink">{formatCurrency(total)}</span>
        </Card>
      </div>
    );
  }

  const categories = [
    { id: "veg", label: "Veg", description: "Fresh vegetarian favourites", color: "bg-emerald-500" },
    { id: "non-veg", label: "Non-Veg", description: "Hearty meals and snacks", color: "bg-rose-500" },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange">Campus dining</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Today&apos;s e-cafe menu</h1>
          <p className="mt-1 text-sm text-muted">Choose your items and quantities. All prices are in INR.</p>
        </div>
        <Badge tone="orange"><Coffee className="h-3 w-3" /> Menu for today</Badge>
      </div>

      <div className="space-y-6">
        {categories.map((category) => {
          const categoryItems = menu.filter((item) => item.category === category.id);
          if (!categoryItems.length) return null;
          return (
            <section key={category.id} aria-labelledby={`menu-${category.id}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${category.color}`} />
                <div>
                  <h2 id={`menu-${category.id}`} className="text-base font-semibold text-ink">{category.label}</h2>
                  <p className="text-xs text-muted">{category.description}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {categoryItems.map((item) => {
                  const quantity = quantities[item.id] ?? 0;
                  return (
                    <Card key={item.id} className="flex flex-col justify-between p-4 sm:p-5">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold text-ink">{item.name}</h3>
                          <span className="shrink-0 text-sm font-bold text-ink">{formatCurrency(item.price)}</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.description}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Quantity</span>
                        {quantity === 0 ? (
                          <Button variant="secondary" size="sm" onClick={() => setQuantity(item.id, 1)}>
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Button
                              variant="secondary"
                              size="icon"
                              aria-label={`Remove one ${item.name}`}
                              onClick={() => setQuantity(item.id, quantity - 1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="min-w-5 text-center text-sm font-semibold text-ink">{quantity}</span>
                            <Button
                              variant="secondary"
                              size="icon"
                              aria-label={`Add one ${item.name}`}
                              onClick={() => setQuantity(item.id, quantity + 1)}
                              disabled={quantity >= 99}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 p-4 shadow-lift backdrop-blur">
        <div>
          <p className="text-xs text-muted">
            {itemCount} {itemCount === 1 ? "item" : "items"} selected
          </p>
          <p className="text-lg font-bold text-ink">{formatCurrency(total)}</p>
        </div>
        <Button size="lg" onClick={() => setStep("payment")} disabled={itemCount === 0}>
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
