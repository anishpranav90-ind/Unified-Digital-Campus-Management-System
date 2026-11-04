import "server-only";
import type { EcafeMenuItem, EcafeOrder, EcafeOrderInput, Profile } from "@/types";
import { getDemoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listEcafeMenu(): Promise<EcafeMenuItem[]> {
  if (isDemoMode()) {
    return getDemoStore().ecafe_menu_items.filter((item) => item.available);
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ecafe_menu_items")
    .select("id, name, category, description, price_paise, available")
    .eq("available", true)
    .order("sort_order");
  if (error) throw new Error(`Could not load the e-Cafe menu: ${error.message}`);
  return (data ?? []) as EcafeMenuItem[];
}

export async function createEcafeOrder(profile: Profile, input: EcafeOrderInput[]) {
  if (!input.length || input.length > 30) return { ok: false as const, error: "Select menu items to continue." };
  if (input.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10)) {
    return { ok: false as const, error: "Choose a quantity between 1 and 10." };
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    const items = input.map((selection) => {
      const menuItem = store.ecafe_menu_items.find((item) => item.id === selection.id && item.available);
      if (!menuItem) return null;
      return {
        id: menuItem.id,
        name: menuItem.name,
        category: menuItem.category,
        quantity: selection.quantity,
        unit_price_paise: menuItem.price_paise,
      };
    });
    if (items.some((item) => !item)) return { ok: false as const, error: "A selected menu item is unavailable." };
    const verifiedItems = items.filter((item): item is NonNullable<typeof item> => item !== null);
    const amount_paise = verifiedItems.reduce((sum, item) => sum + item.unit_price_paise * item.quantity, 0);
    if (!amount_paise) return { ok: false as const, error: "The order total is invalid." };
    const now = new Date().toISOString();
    const order: EcafeOrder = {
      id: crypto.randomUUID(),
      order_number: `EC-${1000 + store.ecafe_orders.length + 1}`,
      user_id: profile.id,
      items: verifiedItems,
      amount_paise,
      status: "PAYMENT_PENDING",
      created_at: now,
      updated_at: now,
    };
    store.ecafe_orders.unshift(order);
    return { ok: true as const, id: order.id };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_ecafe_order", {
    p_items: input.map(({ id, quantity }) => ({ item_id: id, quantity })),
  });
  if (error) return { ok: false as const, error: error.message };
  const created = Array.isArray(data) ? data[0] : data;
  if (!created?.id) return { ok: false as const, error: "The order could not be created." };
  return { ok: true as const, id: created.id as string };
}

export async function getEcafeOrder(profile: Profile, id: string): Promise<EcafeOrder | null> {
  if (isDemoMode()) {
    const order = getDemoStore().ecafe_orders.find((item) => item.id === id);
    if (!order || (profile.role === "student" && order.user_id !== profile.id)) return null;
    return order;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("ecafe_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the e-Cafe order: ${error.message}`);
  return (data as EcafeOrder) ?? null;
}

export async function listEcafeOrders(profile: Profile): Promise<EcafeOrder[]> {
  if (profile.role === "student") {
    if (isDemoMode()) {
      return getDemoStore().ecafe_orders.filter((item) => item.user_id === profile.id);
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("ecafe_orders")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not load your e-Cafe orders: ${error.message}`);
    return (data ?? []) as EcafeOrder[];
  }

  if (isDemoMode()) return getDemoStore().ecafe_orders;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ecafe_orders")
    .select("*")
    .in("status", ["VERIFIED_AND_QUEUED", "COMPLETED"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load the kitchen queue: ${error.message}`);
  return (data ?? []) as EcafeOrder[];
}

export async function completeEcafeOrder(profile: Profile, orderId: string) {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { ok: false as const, error: "Only cafe counter staff can complete orders." };
  }
  if (isDemoMode()) {
    const order = getDemoStore().ecafe_orders.find((item) => item.id === orderId);
    if (!order || order.status !== "VERIFIED_AND_QUEUED") {
      return { ok: false as const, error: "Only verified orders can be completed." };
    }
    order.status = "COMPLETED";
    order.updated_at = new Date().toISOString();
    return { ok: true as const };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complete_ecafe_order", { p_order_id: orderId });
  if (error) return { ok: false as const, error: error.message };
  return data ? { ok: true as const } : { ok: false as const, error: "Only verified orders can be completed." };
}
