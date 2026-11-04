import Link from "next/link";
import { Coffee } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader } from "@/components/ui";
import { parseCafeReceipt } from "@/lib/ecafe/receipt";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "e-cafe receipt" };

export default async function ECafeReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const receipt = data ? parseCafeReceipt(data) : null;

  if (!receipt) {
    return (
      <div className="mx-auto max-w-xl">
        <Badge tone="amber">Receipt unavailable</Badge>
        <h1 className="mt-3 text-xl font-semibold text-ink">This receipt link is invalid</h1>
        <p className="mt-1 text-sm text-muted">Return to e-cafe to create a new bill.</p>
        <ButtonLink className="mt-4" href="/ecafe">Open e-cafe</ButtonLink>
      </div>
    );
  }

  const isCash = receipt.paymentMethod === "cash";
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <Badge tone="green">e-cafe receipt</Badge>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Order {receipt.orderId}</h1>
        <p className="mt-1 text-sm text-muted">{new Date(receipt.createdAt).toLocaleString("en-IN")}</p>
      </div>
      <Card>
        <CardHeader
          title="Bill summary"
          description={isCash ? "Cash due at the cafe counter" : "UPI transfer awaiting cafe confirmation"}
          icon={<Coffee className="h-4 w-4" />}
        />
        <div className="divide-y divide-line px-5">
          {receipt.items.map((item) => (
            <div key={item.itemId} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium text-ink">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <p className="font-semibold text-ink">
                {formatCurrency(item.quantity * item.unitPrice)}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line px-5 py-4">
          <span className="text-sm font-semibold text-ink">Total</span>
          <span className="text-lg font-bold text-ink">{formatCurrency(receipt.total)}</span>
        </div>
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        This is a locally generated receipt preview. Orders and payment confirmations are not stored by the app.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href="/ecafe">Back to e-cafe</ButtonLink>
        <Link href="/dashboard" className="focus-ring inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-ink hover:bg-slate-50">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
