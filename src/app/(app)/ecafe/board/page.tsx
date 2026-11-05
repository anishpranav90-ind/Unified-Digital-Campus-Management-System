import Link from "next/link";
import { Radio, Utensils } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { listEcafeQueueBoard } from "@/lib/data/ecafe";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import type { EcafeQueueBoardEntry } from "@/types";

export const metadata = { title: "e-Cafe token board" };

function TokenColumn({
  title,
  description,
  orders,
}: {
  title: string;
  description: string;
  orders: EcafeQueueBoardEntry[];
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {orders.length ? (
        <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          {orders.map((order) => (
            <li
              key={`${order.service_date}-${order.token_number}`}
              className={`rounded-xl border p-4 text-center ${
                order.status === "READY"
                  ? "border-emerald-200 bg-emerald-50"
                  : order.status === "PREPARING"
                    ? "border-orange-200 bg-orange-50"
                    : "border-line bg-canvas"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Token
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-ink">
                #{String(order.token_number).padStart(3, "0")}
              </p>
              <div className="mt-2 flex justify-center gap-1">
                <Badge tone={order.status === "READY" ? "green" : order.status === "PREPARING" ? "orange" : "blue"}>
                  {order.status}
                </Badge>
                {order.is_express ? <Badge tone="teal">EXPRESS</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No tokens here" description="New paid orders update this board automatically." />
      )}
    </Card>
  );
}

export default async function EcafeBoardPage() {
  await requireProfile();
  const entries = await listEcafeQueueBoard();
  const preparing = entries.filter((entry) => entry.status === "PREPARING");
  const ready = entries.filter((entry) => entry.status === "READY");
  const queued = entries.filter((entry) => entry.status === "QUEUED");

  return (
    <div className="space-y-5">
      <Link href="/ecafe" className="text-xs font-semibold text-brand-blue hover:underline">
        Back to e-Cafe
      </Link>
      <PageHeader
        eyebrow="Live campus dining"
        title="e-Cafe token board"
        description="Follow your token on the live board. Come to the pickup counter only when it is marked READY."
        actions={
          <RealtimeRefresh
            demo={isDemoMode()}
            table="ecafe_queue_board"
            channelKey="ecafe-token-board"
            label="Live token updates"
          />
        }
      />

      <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
        <Radio className="h-4 w-4 shrink-0" />
        <span>Payment-verified orders only. Express items are labelled and kept in their own FIFO lane.</span>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <TokenColumn title="Being Prepared" description="Kitchen has accepted these paid orders." orders={preparing} />
        <TokenColumn title="Ready for Pickup" description="Show your active pickup QR at Window B." orders={ready} />
      </section>

      <TokenColumn title="Queued" description="Paid and waiting for the kitchen, in token order." orders={queued} />
      {!entries.length ? (
        <Card className="p-5">
          <EmptyState
            icon={<Utensils className="h-5 w-5" />}
            title="No active tokens yet"
            description="Tokens appear as soon as payment is verified or cash is collected."
          />
        </Card>
      ) : null}
    </div>
  );
}
