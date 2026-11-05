import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { getEcafeOrder } from "@/lib/data/ecafe";
import { PaymentSelection } from "@/components/payments/payment-selection";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { isDemoMode } from "@/lib/env";
import { getPaymentMethodAvailability } from "@/lib/payments/config";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { QRCodeSVG } from "qrcode.react";

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
        actions={
          <div className="flex items-center gap-2">
            <RealtimeRefresh demo={isDemoMode()} table="ecafe_orders" channelKey={`ecafe-order-${order.id}`} label="Order live" />
            <Badge tone={["QUEUED", "PREPARING", "READY", "COMPLETED", "VERIFIED_AND_QUEUED"].includes(order.status) ? "green" : "amber"}>
              {order.status.replaceAll("_", " ")}
            </Badge>
          </div>
        }
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
      {order.is_express ? (
        <p className="text-xs font-semibold text-teal-700">Express pickup lane</p>
      ) : null}

      {order.status === "PAYMENT_PENDING" ? (
        <PaymentSelection
          module="ecafe"
          entityId={order.id}
          amountPaise={order.amount_paise}
          orderNumber={order.order_number}
          availability={getPaymentMethodAvailability()}
        />
      ) : order.status === "QUEUED" || order.status === "PREPARING" || order.status === "READY" ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your daily token</p>
              <p className="mt-1 text-4xl font-black tabular-nums text-ink">
                #{String(order.token_number ?? 0).padStart(3, "0")}
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">{order.status.replaceAll("_", " ")}</p>
              <p className="mt-1 text-xs text-muted">
                {order.status === "QUEUED"
                  ? "Payment verified. Your order is waiting for the kitchen."
                  : order.status === "PREPARING"
                    ? "The kitchen is preparing your order."
                    : "Your order is ready. Show this pickup QR at Window B."}
              </p>
              {order.is_express ? <Badge className="mt-3" tone="teal">Express order</Badge> : null}
            </div>
            {order.status === "READY" && order.pickup_token ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <QRCodeSVG value={`unisync-ecafe-pickup://${order.pickup_token}`} size={156} level="M" includeMargin />
                <p className="mt-2 text-[10px] font-semibold text-emerald-900">Pickup QR · Token #{order.token_number}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : order.status === "COMPLETED" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          Order completed and handed over. Thank you!
        </p>
      ) : order.status === "VERIFIED_AND_QUEUED" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          Payment verified. Your token is being assigned; this page will update shortly.
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
