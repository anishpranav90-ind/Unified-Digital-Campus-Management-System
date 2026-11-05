import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { listEcafeOrders } from "@/lib/data/ecafe";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PrintCounterVerificationForm } from "@/components/payments/print-counter-verification-form";
import { EcafePickupScanner } from "@/components/ecafe/ecafe-pickup-scanner";
import { updateEcafeOrderStatusAction } from "@/lib/actions/ecafe";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { isDemoMode } from "@/lib/env";
import { formatCurrency } from "@/lib/utils";
import type { EcafeOrder } from "@/types";

export const metadata = { title: "e-Cafe counter" };

function KitchenOrder({ order }: { order: EcafeOrder }) {
  const nextStatus = order.status === "QUEUED" ? "PREPARING" : order.status === "PREPARING" ? "READY" : null;
  const nextLabel = order.status === "QUEUED" ? "Start preparing" : "Mark ready for pickup";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink">
            Token #{String(order.token_number ?? 0).padStart(3, "0")}
          </span>
          <Badge tone={order.status === "READY" ? "green" : order.status === "PREPARING" ? "orange" : "blue"}>
            {order.status}
          </Badge>
          {order.is_express ? <Badge tone="teal">Express</Badge> : null}
        </div>
        <p className="mt-1 text-[10px] text-muted">
          {order.order_number} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
        </p>
        <p className="mt-1 text-xs text-ink">
          {order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-ink">{formatCurrency(order.amount_paise / 100)}</span>
        {nextStatus ? (
          <form action={updateEcafeOrderStatusAction}>
            <input type="hidden" name="order_id" value={order.id} />
            <input type="hidden" name="status" value={nextStatus} />
            <Button type="submit" size="sm" variant={nextStatus === "READY" ? "accent" : "secondary"}>
              {nextLabel}
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function KitchenLane({ title, orders }: { title: string; orders: EcafeOrder[] }) {
  if (!orders.length) return null;
  const statuses = ["QUEUED", "PREPARING", "READY"] as const;
  return (
    <section className="border-t border-line first:border-t-0">
      <h3 className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {statuses.map((status) => {
        const laneOrders = orders.filter((order) => order.status === status);
        if (!laneOrders.length) return null;
        return (
          <div key={status}>
            <p className="px-5 pt-3 text-[10px] font-semibold text-muted">{status} · {laneOrders.length}</p>
            <ul className="divide-y divide-line">
              {laneOrders.map((order) => <KitchenOrder key={order.id} order={order} />)}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

export default async function EcafeCounterPage({
  searchParams,
}: PageProps<"/ecafe/counter">) {
  const profile = await requireProfile();
  if (profile.role !== "faculty" && profile.role !== "admin") redirect("/ecafe");
  const params = await searchParams;
  const orders = await listEcafeOrders(profile);
  const queueCount = orders.length;

  return (
    <div className="space-y-5">
      <Link href="/ecafe" className="text-xs font-semibold text-brand-blue hover:underline">Back to e-Cafe</Link>
      <PageHeader
        eyebrow="Cafe staff tools"
        title="Kitchen & pickup counter"
        description="Only payment-verified orders enter the kitchen. Cash QR orders stay hidden until collected."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/ecafe/board" className="text-xs font-semibold text-brand-blue hover:underline">
              Open TV token board
            </Link>
            <RealtimeRefresh demo={isDemoMode()} table="ecafe_orders" channelKey="ecafe-kitchen" label="Kitchen live" />
          </div>
        }
      />
      {params.error ? <Alert tone="error">{params.error}</Alert> : null}
      {params.updated ? (
        <Alert tone="success">Order moved to {String(params.updated).toUpperCase()}.</Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Window A · Cashier verification"
          description="Scan the pending cash QR only after receiving cash. For direct UPI, verify the bank reference. Razorpay orders queue after server verification."
        />
        <PrintCounterVerificationForm />
      </Card>

      <Card>
        <CardHeader
          title="Kitchen FIFO queue"
          description={`${queueCount} paid order${queueCount === 1 ? "" : "s"} · sorted by verified token order`}
        />
        {queueCount ? (
          <div className="divide-y divide-line">
            <KitchenLane title="Express fast-track · FIFO within lane" orders={orders.filter((order) => order.is_express)} />
            <KitchenLane title="Standard queue · FIFO" orders={orders.filter((order) => !order.is_express)} />
          </div>
        ) : (
          <EmptyState title="Kitchen queue is clear" description="Pending unpaid cash orders are not shown here." />
        )}
      </Card>

      <Card>
        <CardHeader
          title="Window B · Pickup scanner"
          description="Only READY orders can be handed over. Early or duplicate scans are rejected."
        />
        <EcafePickupScanner />
      </Card>
    </div>
  );
}
