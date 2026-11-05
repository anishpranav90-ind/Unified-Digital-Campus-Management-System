"use client";

import { useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { getDemoTokens, type DemoToken } from "@/lib/demoTokens";
import type { EcafeQueueBoardEntry } from "@/types";

function TokenColumn({
  title,
  description,
  orders,
  demo,
}: {
  title: string;
  description: string;
  orders: EcafeQueueBoardEntry[];
  demo: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {orders.length ? (
        <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const sample = demo ? order as DemoToken : null;
            return (
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
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Token</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-ink">
                  #{String(order.token_number).padStart(3, "0")}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  <Badge tone={order.status === "READY" ? "green" : order.status === "PREPARING" ? "orange" : "blue"}>
                    {order.status === "READY" ? "Ready for Pickup" : order.status === "PREPARING" ? "Being Prepared" : "Queued"}
                  </Badge>
                  {order.is_express ? <Badge tone="teal">EXPRESS LANE</Badge> : null}
                </div>
                {sample ? (
                  <>
                    <p className="mt-3 text-xs font-medium text-ink">{sample.items}</p>
                    <p className="mt-1 text-[10px] text-muted">Payment: {sample.paymentMethod}</p>
                    {sample.location ? <p className="mt-1 text-[10px] font-semibold text-emerald-800">{sample.location}</p> : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No tokens here" description="New paid orders update this board automatically." />
      )}
    </Card>
  );
}

export function EcafeTokenBoard({
  entries,
  demo,
}: {
  entries: EcafeQueueBoardEntry[];
  demo: boolean;
}) {
  const [sampleOrders, setSampleOrders] = useState<DemoToken[]>(getDemoTokens);
  const showingSamples = demo && entries.length === 0;
  const orders: EcafeQueueBoardEntry[] = showingSamples ? sampleOrders : entries;
  const preparing = orders.filter((entry) => entry.status === "PREPARING");
  const ready = orders.filter((entry) => entry.status === "READY");
  const queued = orders.filter((entry) => entry.status === "QUEUED");

  function advanceSamples() {
    setSampleOrders((current) => {
      const next = current.map((token) => ({ ...token }));
      const movingIndex = next.findIndex(
        (token) => token.token_number >= 44 && token.status !== "READY",
      );
      if (movingIndex !== -1) {
        const movingToken = next[movingIndex];
        if (movingToken.status === "QUEUED") {
          movingToken.status = "PREPARING";
        } else {
          movingToken.status = "READY";
          movingToken.location = "Window B";
        }
        return next;
      }
      return getDemoTokens();
    });
  }

  function resetSamples() {
    setSampleOrders(getDemoTokens());
  }

  return (
    <>
      {showingSamples ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs font-semibold">Sample token board</p>
                <p className="mt-1 text-[10px] leading-relaxed">
                  These are demo-only cards and never enter the real kitchen queue. The pending-cash sample is not a paid order.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={advanceSamples}>
                Advance sample orders
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetSamples} aria-label="Reset sample tokens">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-2">
        <TokenColumn title="Being Prepared" description="Kitchen has accepted these paid orders." orders={preparing} demo={showingSamples} />
        <TokenColumn title="Ready for Pickup" description="Show your active pickup QR at Window B." orders={ready} demo={showingSamples} />
      </section>
      <TokenColumn title="Queued" description="Paid and waiting for the kitchen, in token order." orders={queued} demo={showingSamples} />
      {!orders.length ? (
        <Card className="p-5">
          <EmptyState
            title="No active tokens yet"
            description="Tokens appear as soon as payment is verified or cash is collected."
          />
        </Card>
      ) : null}
    </>
  );
}
