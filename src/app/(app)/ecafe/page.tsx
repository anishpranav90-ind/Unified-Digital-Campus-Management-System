import Link from "next/link";
import { Utensils } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { listEcafeMenu, listEcafeOrders } from "@/lib/data/ecafe";
import { PageHeader, Card, CardHeader, EmptyState } from "@/components/ui";
import { EcafeMenu } from "@/components/ecafe/ecafe-menu";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const metadata = { title: "e-Cafe" };

export default async function EcafePage() {
  const profile = await requireProfile();
  const [menu, orders] = await Promise.all([listEcafeMenu(), listEcafeOrders(profile)]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Campus dining"
        title="e-Cafe"
        description="Choose from today's menu, pay securely, and track your kitchen token live. Unpaid cash orders are not sent to the kitchen."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/ecafe/board" className="text-xs font-semibold text-brand-blue hover:underline">
              Live token board
            </Link>
            {profile.role === "faculty" || profile.role === "admin" ? (
              <>
                <Link href="/cashier" className="text-xs font-semibold text-brand-blue hover:underline">
                  Cashier verification
                </Link>
                <Link href="/ecafe/counter" className="text-xs font-semibold text-brand-blue hover:underline">
                  Staff kitchen & pickup
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      <h2 className="text-sm font-semibold text-ink">Today&apos;s menu</h2>
      <EcafeMenu menu={menu} />

      {orders.length ? (
        <Card>
          <CardHeader title="Your recent orders" icon={<Utensils className="h-4 w-4" />} />
          <ul className="divide-y divide-line">
            {orders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <Link
                  href={`/ecafe/order/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-xs font-semibold text-ink">{order.order_number}</span>
                    <span className="block text-[10px] text-muted">{formatDateTime(order.created_at)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-xs font-semibold text-ink">
                      {formatCurrency(order.amount_paise / 100)}
                    </span>
                    <span className="block text-[10px] font-semibold text-brand-blue">
                      {order.status === "PAYMENT_PENDING"
                        ? "Continue payment"
                        : ["QUEUED", "PREPARING", "READY"].includes(order.status)
                          ? `Track token #${String(order.token_number ?? 0).padStart(3, "0")}`
                          : order.status.replaceAll("_", " ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          icon={<Utensils className="h-5 w-5" />}
          title="No orders yet"
          description="Your orders and receipts will appear here."
        />
      )}
    </div>
  );
}
