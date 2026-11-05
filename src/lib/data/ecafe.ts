import "server-only";
import { randomBytes } from "node:crypto";
import type {
  EcafeMenuItem,
  EcafeOrder,
  EcafeOrderInput,
  EcafeQueueBoardEntry,
  Profile,
} from "@/types";
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
    .select("id, name, category, description, price_paise, available, is_express")
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
      is_express: verifiedItems.every((item) =>
        store.ecafe_menu_items.find((menuItem) => menuItem.id === item.id)?.is_express === true,
      ),
      payment_method: null,
      pickup_token: null,
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

  if (isDemoMode()) {
    return getDemoStore().ecafe_orders
      .filter((order) => ["QUEUED", "PREPARING", "READY"].includes(order.status))
      .sort((a, b) => {
        const dateOrder = (a.service_date ?? "").localeCompare(b.service_date ?? "");
        return dateOrder || (a.token_number ?? 0) - (b.token_number ?? 0);
      });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ecafe_orders")
    .select("*")
    .in("status", ["QUEUED", "PREPARING", "READY"])
    .order("service_date", { ascending: true })
    .order("token_number", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Could not load the kitchen queue: ${error.message}`);
  return (data ?? []) as EcafeOrder[];
}

function currentCafeDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function listEcafeQueueBoard(): Promise<EcafeQueueBoardEntry[]> {
  const serviceDate = currentCafeDate();
  if (isDemoMode()) {
    return getDemoStore().ecafe_orders
      .filter(
        (order) =>
          order.service_date === serviceDate &&
          order.token_number &&
          ["QUEUED", "PREPARING", "READY"].includes(order.status),
      )
      .map((order) => ({
        service_date: serviceDate,
        token_number: order.token_number!,
        is_express: order.is_express === true,
        status: order.status as "QUEUED" | "PREPARING" | "READY",
      }))
      .sort((a, b) => a.token_number - b.token_number);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ecafe_queue_board")
    .select("service_date, token_number, is_express, status")
    .eq("service_date", serviceDate)
    .order("token_number", { ascending: true });
  if (error) throw new Error(`Could not load the e-Cafe token board: ${error.message}`);
  return (data ?? []) as EcafeQueueBoardEntry[];
}

export async function updateEcafeOrderStatus(
  profile: Profile,
  orderId: string,
  status: "PREPARING" | "READY",
) {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { ok: false as const, error: "Only cafe staff can update kitchen orders." };
  }
  if (isDemoMode()) {
    const order = getDemoStore().ecafe_orders.find((item) => item.id === orderId);
    if (!order || (status === "PREPARING" && order.status !== "QUEUED") ||
      (status === "READY" && order.status !== "PREPARING")) {
      return { ok: false as const, error: "Order status changed; refresh the kitchen queue and try again." };
    }
    const now = new Date().toISOString();
    order.status = status;
    order.updated_at = new Date().toISOString();
    if (status === "PREPARING") order.preparing_at = now;
    if (status === "READY") {
      order.ready_at = now;
      order.pickup_token = randomBytes(32).toString("hex");
    }
    return { ok: true as const, pickupToken: order.pickup_token ?? null };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_ecafe_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, pickupToken: typeof data === "string" ? data : null };
}

export interface EcafePickupResult {
  found: boolean;
  completed: boolean;
  order_status: string;
  order_number: string | null;
  token_number: number | null;
  queue_position: number | null;
  items: EcafeOrder["items"] | null;
}

export async function redeemEcafePickup(profile: Profile, pickupToken: string): Promise<EcafePickupResult> {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    throw new Error("Only authorized cafe counter staff can redeem pickup QR codes.");
  }
  if (!/^[\da-f]{64}$/.test(pickupToken)) {
    return {
      found: false,
      completed: false,
      order_status: "NOT_FOUND",
      order_number: null,
      token_number: null,
      queue_position: null,
      items: null,
    };
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    const order = store.ecafe_orders.find((item) => item.pickup_token === pickupToken);
    if (!order) {
      return {
        found: false,
        completed: false,
        order_status: "NOT_FOUND",
        order_number: null,
        token_number: null,
        queue_position: null,
        items: null,
      };
    }
    if (order.status === "READY") {
      order.status = "COMPLETED";
      order.pickup_token = null;
      order.completed_at = new Date().toISOString();
      order.updated_at = order.completed_at;
      return {
        found: true,
        completed: true,
        order_status: "COMPLETED",
        order_number: order.order_number,
        token_number: order.token_number ?? null,
        queue_position: 0,
        items: order.items,
      };
    }
    const queuePosition = ["QUEUED", "PREPARING"].includes(order.status)
      ? store.ecafe_orders.filter(
          (item) =>
            item.service_date === order.service_date &&
            item.is_express === order.is_express &&
            (item.token_number ?? Number.MAX_SAFE_INTEGER) <= (order.token_number ?? 0) &&
            ["QUEUED", "PREPARING"].includes(item.status),
        ).length
      : 0;
    return {
      found: true,
      completed: false,
      order_status: order.status,
      order_number: order.order_number,
      token_number: order.token_number ?? null,
      queue_position: queuePosition,
      items: order.items,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("redeem_ecafe_pickup", {
    p_pickup_token: pickupToken,
  });
  if (error) throw new Error(`Could not verify the pickup QR: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    return {
      found: false,
      completed: false,
      order_status: "NOT_FOUND",
      order_number: null,
      token_number: null,
      queue_position: null,
      items: null,
    };
  }
  return result as EcafePickupResult;
}
