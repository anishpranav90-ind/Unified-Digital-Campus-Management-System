import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { getEcafeOrder } from "@/lib/data/ecafe";
import { PaymentSelection } from "@/components/payments/payment-selection";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "e-Cafe order" };

export default async function EcafeOrderPage({ params }: PageProps<"/ecafe/order/[id]">) {
  const profile = await requireProfile();
  const { id } = await params;
  const order = await getEcafeOrder(profile, id);
  if (!order) notFound();

  return (
    <div className="space-y-5">
      <Link href="/ecafe" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to e-Cafe
      </Link>
      <PageHeader
        eyebrow={`e-Cafe · ${order.order_number}`}
        title="Order summary"
        description={`Placed ${formatDateTime(order.created_at)}`}
        actions={<Badge tone={order.status === "VERIFIED_AND_QUEUED" || order.status === "COMPLETED" ? "green" : "amber"}>{order.status.replaceAll("_", " ")}</Badge>}
      />

      <Card>
        <CardHeader title="Receipt" icon={<ReceiptText className="h-4 w-4" />} />
        <div className="divide-y divide-line px-5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-xs font-semibold text-ink">{item.name}</p>
                <p className="text-[10px] text-muted">
                  {item.quantity} × {formatCurrency(item.unit_price_paise / 100)}
                </p>
              </div>
              <p className="text-xs font-semibold text-ink">
                {formatCurrency((item.quantity * item.unit_price_paise) / 100)}
              </p>
            </div>
          ))}
          <div className="flex justify-between py-4 text-sm font-bold text-ink">
            <span>Total</span>
            <span>{formatCurrency(order.amount_paise / 100)}</span>
          </div>
        </div>
      </Card>

      {order.status === "PAYMENT_PENDING" ? (
        <PaymentSelection
          module="ecafe"
          entityId={order.id}
          amountPaise={order.amount_paise}
          orderNumber={order.order_number}
        />
      ) : order.status === "VERIFIED_AND_QUEUED" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          Payment verified. Your order is in the kitchen queue.
        </p>
      ) : null}
      {isDemoMode() ? (
        <p className="text-[10px] text-muted">
          Demo mode stores orders in server memory and resets when the server restarts.
        </p>
      ) : null}
    </div>
  );
}
