import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { listEcafeOrders } from "@/lib/data/ecafe";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PrintCounterVerificationForm } from "@/components/payments/print-counter-verification-form";
import { completeEcafeOrderAction } from "@/lib/actions/ecafe";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const metadata = { title: "e-Cafe counter" };

export default async function EcafeCounterPage({
  searchParams,
}: PageProps<"/ecafe/counter">) {
  const profile = await requireProfile();
  if (profile.role !== "faculty" && profile.role !== "admin") redirect("/ecafe");
  const params = await searchParams;
  const orders = await listEcafeOrders(profile);
  const queue = orders.filter((order) => order.status === "VERIFIED_AND_QUEUED");

  return (
    <div className="space-y-5">
      <Link href="/ecafe" className="text-xs font-semibold text-brand-blue hover:underline">Back to e-Cafe</Link>
      <PageHeader
        eyebrow="Staff tools"
        title="Cafe counter"
        description="Scan payment QR codes after confirming receipt. Only verified orders are sent to the kitchen queue."
      />
      {params.error ? <Alert tone="error">{params.error}</Alert> : null}
      {params.completed ? <Alert tone="success">Order completed and receipt updated.</Alert> : null}

      <Card>
        <CardHeader
          title="Verify a pending payment"
          description="Cash or UPI. For UPI, compare the entered reference with the payment app/bank record."
        />
        <PrintCounterVerificationForm />
      </Card>

      <Card>
        <CardHeader title="Verified kitchen queue" description={`${queue.length} order${queue.length === 1 ? "" : "s"} ready for preparation`} />
        {queue.length ? (
          <ul className="divide-y divide-line">
            {queue.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/ecafe/order/${order.id}`} className="text-xs font-semibold text-ink hover:underline">
                      {order.order_number}
                    </Link>
                    <Badge tone="green">Paid</Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">{formatDateTime(order.created_at)}</p>
                  <p className="mt-1 text-xs text-ink">
                    {order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-ink">{formatCurrency(order.amount_paise / 100)}</span>
                  <form action={completeEcafeOrderAction}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <Button type="submit" size="sm" variant="accent">Complete order</Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Kitchen queue is clear" description="Only payment-verified cafe orders appear here." />
        )}
      </Card>
    </div>
  );
}
