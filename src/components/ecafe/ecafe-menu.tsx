"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { createEcafeOrderAction } from "@/lib/actions/ecafe";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import type { EcafeMenuItem } from "@/types";
import { formatCurrency } from "@/lib/utils";

export function EcafeMenu({ menu }: { menu: EcafeMenuItem[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [state, formAction, pending] = useActionState(createEcafeOrderAction, EMPTY_FORM_STATE);
  const router = useRouter();
  const selected = useMemo(
    () => Object.entries(quantities).filter(([, quantity]) => quantity > 0),
    [quantities],
  );
  const totalPaise = useMemo(
    () =>
      selected.reduce((total, [id, quantity]) => {
        const item = menu.find((entry) => entry.id === id);
        return total + (item?.price_paise ?? 0) * quantity;
      }, 0),
    [menu, selected],
  );

  useEffect(() => {
    if (state.orderId) router.push(`/ecafe/order/${state.orderId}`);
  }, [router, state.orderId]);

  function setQuantity(id: string, quantity: number) {
    setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.min(10, quantity)) }));
  }

  return (
    <div className="space-y-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {(["veg", "non_veg"] as const).map((category) => {
        const items = menu.filter((item) => item.category === category);
        if (!items.length) return null;
        return (
          <section key={category}>
            <h3 className="mb-3 text-sm font-semibold text-ink">
              {category === "veg" ? "Vegetarian" : "Non-vegetarian"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <Card key={item.id} className="flex flex-col p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-3 w-3 shrink-0 rounded-sm border-2 ${
                        category === "veg" ? "border-emerald-600" : "border-red-600"
                      }`}
                      aria-label={category === "veg" ? "Vegetarian" : "Non-vegetarian"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink">{item.name}</h3>
                        {item.is_express ? <Badge tone="teal">Express pickup</Badge> : null}
                      </div>
                      <p className="mt-1 min-h-8 text-xs text-muted">{item.description}</p>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        {formatCurrency(item.price_paise / 100)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                    <span className="text-[11px] text-muted">Quantity</span>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        aria-label={`Decrease ${item.name}`}
                        disabled={!quantities[item.id]}
                        onClick={() => setQuantity(item.id, (quantities[item.id] ?? 0) - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-4 text-center text-xs font-semibold">{quantities[item.id] ?? 0}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        aria-label={`Increase ${item.name}`}
                        disabled={(quantities[item.id] ?? 0) >= 10}
                        onClick={() => setQuantity(item.id, (quantities[item.id] ?? 0) + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      <form action={formAction} className="sticky bottom-3 z-10 rounded-2xl border border-line bg-white/95 p-4 shadow-lift backdrop-blur">
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(selected.map(([id, quantity]) => ({ id, quantity })))}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-brand-orange" />
            <span className="text-xs text-muted">{selected.reduce((sum, [, count]) => sum + count, 0)} items</span>
            <span className="text-sm font-semibold text-ink">{formatCurrency(totalPaise / 100)}</span>
          </div>
          <Button type="submit" variant="accent" size="sm" disabled={pending || !selected.length}>
            {pending ? "Preparing checkout…" : "Next"}
          </Button>
        </div>
      </form>
    </div>
  );
}
