import "server-only";
import { createHash } from "node:crypto";
import type { EcafeOrderItem, PaymentMethod, PaymentTransaction, Profile } from "@/types";
import { getDemoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceDemoUrgentPrintCapacity, notifyUrgentPrintFallback } from "@/lib/data/printpulse";

export function hashCounterToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface PendingCashEcafeOrder {
  order_number: string;
  items: EcafeOrderItem[];
  amount_paise: number;
}

function currentCafeDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function getPendingCashEcafeOrder(
  profile: Profile,
  transactionId: string,
  tokenHash: string,
): Promise<PendingCashEcafeOrder | null> {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return null;
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    const transaction = store.payment_transactions.find(
      (item) =>
        item.id === transactionId &&
        item.module === "ecafe" &&
        item.method === "cash" &&
        item.status === "pending" &&
        item.counter_token_hash === tokenHash,
    );
    if (!transaction?.ecafe_order_id) return null;
    const order = store.ecafe_orders.find((item) => item.id === transaction.ecafe_order_id);
    if (
      !order ||
      order.user_id !== transaction.user_id ||
      order.status !== "PAYMENT_PENDING" ||
      order.amount_paise !== transaction.amount_paise
    ) {
      return null;
    }
    return {
      order_number: order.order_number,
      items: order.items,
      amount_paise: order.amount_paise,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: transaction, error: transactionError } = await supabase
    .from("payment_transactions")
    .select("id, user_id, module, ecafe_order_id, amount_paise, method, status, counter_token_hash")
    .eq("id", transactionId)
    .maybeSingle();
  if (transactionError) {
    throw new Error(`Could not verify the cashier QR: ${transactionError.message}`);
  }
  if (
    !transaction ||
    transaction.module !== "ecafe" ||
    transaction.method !== "cash" ||
    transaction.status !== "pending" ||
    transaction.counter_token_hash !== tokenHash ||
    !transaction.ecafe_order_id
  ) {
    return null;
  }

  const { data: order, error: orderError } = await supabase
    .from("ecafe_orders")
    .select("order_number, user_id, items, amount_paise, status")
    .eq("id", transaction.ecafe_order_id)
    .maybeSingle();
  if (orderError) {
    throw new Error(`Could not load the pending cafe order: ${orderError.message}`);
  }
  if (
    !order ||
    order.user_id !== transaction.user_id ||
    order.status !== "PAYMENT_PENDING" ||
    Number(order.amount_paise) !== Number(transaction.amount_paise)
  ) {
    return null;
  }

  return {
    order_number: order.order_number,
    items: order.items as EcafeOrderItem[],
    amount_paise: Number(order.amount_paise),
  };
}

function enqueueDemoEcafeOrder(
  store: ReturnType<typeof getDemoStore>,
  order: ReturnType<typeof getDemoStore>["ecafe_orders"][number],
  method: PaymentMethod,
) {
  const serviceDate = currentCafeDate();
  const latestToken = store.ecafe_orders.reduce(
    (max, queued) => queued.service_date === serviceDate ? Math.max(max, queued.token_number ?? 0) : max,
    0,
  );
  order.service_date = serviceDate;
  order.token_number = latestToken + 1;
  order.status = "QUEUED";
  order.payment_method = method;
  order.pickup_token = null;
  order.updated_at = new Date().toISOString();
}

export async function startPaymentTransaction(
  profile: Profile,
  module: "printpulse" | "ecafe",
  entityId: string,
  method: PaymentMethod,
  counterTokenHash: string,
  counterToken: string,
) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const existing = store.payment_transactions.find(
      (item) =>
        item.user_id === profile.id &&
        item.module === module &&
        item.status === "pending" &&
        (module === "printpulse" ? item.print_request_id === entityId : item.ecafe_order_id === entityId),
    );
    if (existing) {
      if (existing.method !== method) {
        return {
          ok: false as const,
          error: "A payment session is already pending for this order. Continue that payment method instead.",
        };
      }
      return {
        ok: true as const,
        id: existing.id,
        amountPaise: existing.amount_paise,
        counterToken: existing.counter_token ?? null,
        razorpayOrderId: existing.razorpay_order_id,
      };
    }

    const printRequest =
      module === "printpulse"
        ? store.print_requests.find((request) => request.id === entityId)
        : undefined;
    const cafeOrder =
      module === "ecafe" ? store.ecafe_orders.find((order) => order.id === entityId) : undefined;
    const ownedAndPending =
      module === "printpulse"
        ? printRequest?.student_id === profile.id &&
          printRequest.status === "payment_pending" &&
          printRequest.payment_status === "unpaid" &&
          printRequest.payment_option === method &&
          ((method === "cash" && Boolean(printRequest.file_path) && !printRequest.upload_after_payment) ||
            (method !== "cash" && !printRequest.file_path && printRequest.upload_after_payment))
        : cafeOrder?.user_id === profile.id && cafeOrder.status === "PAYMENT_PENDING";
    if (!ownedAndPending) return { ok: false as const, error: "Pending order not found." };
    const amount_paise =
      module === "printpulse"
        ? Math.round(Number(printRequest!.estimated_cost) * 100)
        : cafeOrder!.amount_paise;
    if (amount_paise <= 0) return { ok: false as const, error: "The payment amount is invalid." };
    const transaction: PaymentTransaction = {
      id: crypto.randomUUID(),
      user_id: profile.id,
      module,
      print_request_id: module === "printpulse" ? entityId : null,
      ecafe_order_id: module === "ecafe" ? entityId : null,
      amount_paise,
      method,
      status: "pending",
      counter_token_hash: method === "razorpay" ? null : counterTokenHash,
      counter_token: method === "razorpay" ? null : counterToken,
      razorpay_order_id: null,
      razorpay_payment_id: null,
      payment_reference: null,
      created_at: new Date().toISOString(),
      verified_at: null,
    };
    store.payment_transactions.unshift(transaction);
    return {
      ok: true as const,
      id: transaction.id,
      amountPaise: amount_paise,
      counterToken: transaction.counter_token,
      razorpayOrderId: transaction.razorpay_order_id,
    };
  }

  const supabase = await createSupabaseServerClient();
  const pending = await getPendingPaymentTransaction(profile, module, entityId);
  if (pending) {
    if (pending.method !== method) {
      return {
        ok: false as const,
        error: "A payment session is already pending for this order. Continue that payment method instead.",
      };
    }
    return {
      ok: true as const,
      id: pending.id,
      amountPaise: pending.amount_paise,
      counterToken: pending.counter_token,
      razorpayOrderId: pending.razorpay_order_id,
    };
  }

  const { data, error } = await supabase.rpc("start_payment_transaction", {
    p_module: module,
    p_entity_id: entityId,
    p_method: method,
    p_counter_token_hash: method === "razorpay" ? null : counterTokenHash,
    p_counter_token: counterToken,
  });
  if (error) {
    const raced = await getPendingPaymentTransaction(profile, module, entityId);
    if (raced?.method === method) {
      return {
        ok: true as const,
        id: raced.id,
        amountPaise: raced.amount_paise,
        counterToken: raced.counter_token,
        razorpayOrderId: raced.razorpay_order_id,
      };
    }
    return { ok: false as const, error: error.message };
  }
  const transaction = Array.isArray(data) ? data[0] : data;
  if (!transaction?.id || !Number.isInteger(transaction.amount_paise)) {
    return { ok: false as const, error: "The payment request could not be created." };
  }
  return {
    ok: true as const,
    id: transaction.id as string,
    amountPaise: transaction.amount_paise as number,
    counterToken: method === "razorpay" ? null : counterToken,
    razorpayOrderId: null,
  };
}

export async function getPendingPaymentTransaction(
  profile: Profile,
  module: "printpulse" | "ecafe",
  entityId: string,
): Promise<PaymentTransaction | null> {
  if (isDemoMode()) {
    return (
      getDemoStore().payment_transactions.find(
        (item) =>
          item.user_id === profile.id &&
          item.module === module &&
          item.status === "pending" &&
          (module === "printpulse" ? item.print_request_id === entityId : item.ecafe_order_id === entityId),
      ) ?? null
    );
  }
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("payment_transactions")
    .select("*")
    .eq("user_id", profile.id)
    .eq("module", module)
    .eq("status", "pending");
  query =
    module === "printpulse"
      ? query.eq("print_request_id", entityId)
      : query.eq("ecafe_order_id", entityId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load the pending payment session: ${error.message}`);
  if (!data) return null;

  let counterToken: string | null = null;
  if (data.method === "cash" || data.method === "upi") {
    const { data: secret, error: secretError } = await supabase
      .from("payment_transaction_secrets")
      .select("counter_token")
      .eq("transaction_id", data.id)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (secretError) throw new Error(`Could not load the payment QR: ${secretError.message}`);
    counterToken = secret?.counter_token ?? null;
  }
  return { ...(data as PaymentTransaction), counter_token: counterToken };
}

export async function setRazorpayOrder(profile: Profile, transactionId: string, orderId: string) {
  if (isDemoMode()) {
    const transaction = getDemoStore().payment_transactions.find(
      (item) => item.id === transactionId && item.user_id === profile.id && item.method === "razorpay",
    );
    if (!transaction || transaction.status !== "pending" || transaction.razorpay_order_id) {
      return { ok: false as const, error: "Razorpay transaction not found." };
    }
    transaction.razorpay_order_id = orderId;
    return { ok: true as const };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_razorpay_order", {
    p_transaction_id: transactionId,
    p_order_id: orderId,
  });
  if (error) return { ok: false as const, error: error.message };
  return data ? { ok: true as const } : { ok: false as const, error: "Could not attach the Razorpay order." };
}

export async function verifyCounterPayment(
  profile: Profile,
  transactionId: string,
  method: "upi" | "cash",
  tokenHash: string,
  reference: string | null,
) {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { ok: false as const, error: "Only authorized counter staff can verify payments." };
  }

  if (isDemoMode()) {
    const store = getDemoStore();
    const transaction = store.payment_transactions.find(
      (item) =>
        item.id === transactionId &&
        item.method === method &&
        item.status === "pending" &&
        item.counter_token_hash === tokenHash,
    );
    if (!transaction) return { ok: false as const, error: "Payment QR or method is invalid." };
    if (method === "upi" && !reference?.trim()) {
      return { ok: false as const, error: "Enter the UPI transaction reference after confirming receipt." };
    }
    if (transaction.module === "printpulse") {
      const request = store.print_requests.find((item) => item.id === transaction.print_request_id);
      if (
        !request ||
        request.status !== "payment_pending" ||
        request.payment_status !== "unpaid" ||
        Math.round(Number(request.estimated_cost) * 100) !== transaction.amount_paise
      ) {
        return { ok: false as const, error: "The print request amount or state has changed." };
      }
      request.payment_status = "paid";
      request.payment_method = method;
      request.status = request.file_path ? "submitted" : "payment_pending";
      request.updated_at = new Date().toISOString();
      if (enforceDemoUrgentPrintCapacity(request)) {
        await notifyUrgentPrintFallback(request.student_id, request.id, request.request_number);
      }
    } else {
      const order = store.ecafe_orders.find((item) => item.id === transaction.ecafe_order_id);
      if (!order || order.status !== "PAYMENT_PENDING" || order.amount_paise !== transaction.amount_paise) {
        return { ok: false as const, error: "The cafe order amount or state has changed." };
      }
      enqueueDemoEcafeOrder(store, order, method);
    }
    transaction.status = "verified";
    transaction.payment_reference = reference?.trim() || null;
    transaction.verified_at = new Date().toISOString();
    return { ok: true as const };
  }

  const supabase = await createSupabaseServerClient();
  const { data: transactionBefore, error: requestLookupError } = await supabase
    .from("payment_transactions")
    .select("module, print_request_id")
    .eq("id", transactionId)
    .maybeSingle();
  if (requestLookupError) return { ok: false as const, error: requestLookupError.message };
  let printRequestBefore: {
    id: string;
    student_id: string;
    request_number: string;
    priority: "normal" | "urgent";
  } | null = null;
  if (transactionBefore?.module === "printpulse" && transactionBefore.print_request_id) {
    const { data: request, error: printRequestError } = await supabase
      .from("print_requests")
      .select("id, student_id, request_number, priority")
      .eq("id", transactionBefore.print_request_id)
      .maybeSingle();
    if (printRequestError) return { ok: false as const, error: printRequestError.message };
    printRequestBefore = request;
  }
  const { data, error } = await supabase.rpc("settle_payment_transaction", {
    p_transaction_id: transactionId,
    p_source: method,
    p_counter_token_hash: tokenHash,
    p_payment_reference: reference?.trim() || null,
    p_razorpay_order_id: null,
    p_razorpay_payment_id: null,
  });
  if (error) return { ok: false as const, error: error.message };
  if (data && printRequestBefore?.priority === "urgent") {
    const { data: printRequestAfter, error: priorityError } = await supabase
      .from("print_requests")
      .select("priority, urgent_fallback_at")
      .eq("id", printRequestBefore.id)
      .maybeSingle();
    if (priorityError) return { ok: false as const, error: `Payment was verified, but queue priority could not be confirmed: ${priorityError.message}` };
    if (printRequestAfter?.priority === "normal" && printRequestAfter.urgent_fallback_at) {
      await notifyUrgentPrintFallback(
        printRequestBefore.student_id,
        printRequestBefore.id,
        printRequestBefore.request_number,
      );
    }
  }
  return data ? { ok: true as const } : { ok: false as const, error: "This transaction is no longer pending." };
}

export async function getRazorpayTransaction(transactionId: string) {
  if (isDemoMode()) {
    return getDemoStore().payment_transactions.find((item) => item.id === transactionId) ?? null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("method", "razorpay")
    .maybeSingle();
  if (error) throw new Error(`Could not load payment transaction: ${error.message}`);
  return (data as PaymentTransaction) ?? null;
}

export async function settleVerifiedRazorpayPayment(input: {
  transactionId: string;
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false as const, error: "Configure the Supabase service role key for verified payment settlement." };
  const { data: transaction, error: lookupError } = await admin
    .from("payment_transactions")
    .select("id, amount_paise, razorpay_order_id, method, status, module, print_request_id")
    .eq("id", input.transactionId)
    .maybeSingle();
  if (lookupError) return { ok: false as const, error: lookupError.message };
  if (
    !transaction ||
    transaction.status !== "pending" ||
    transaction.method !== "razorpay" ||
    transaction.razorpay_order_id !== input.orderId ||
    Number(transaction.amount_paise) !== input.amountPaise ||
    input.currency !== "INR"
  ) {
    return { ok: false as const, error: "The captured payment does not match the pending order." };
  }

  let printRequestBefore: {
    id: string;
    student_id: string;
    request_number: string;
    priority: "normal" | "urgent";
  } | null = null;
  if (transaction.module === "printpulse" && transaction.print_request_id) {
    const { data: request, error: requestError } = await admin
      .from("print_requests")
      .select("id, student_id, request_number, priority")
      .eq("id", transaction.print_request_id)
      .maybeSingle();
    if (requestError) return { ok: false as const, error: requestError.message };
    printRequestBefore = request;
  }
  const { data, error } = await admin.rpc("settle_payment_transaction", {
    p_transaction_id: input.transactionId,
    p_source: "razorpay",
    p_counter_token_hash: null,
    p_payment_reference: null,
    p_razorpay_order_id: input.orderId,
    p_razorpay_payment_id: input.paymentId,
  });
  if (error) return { ok: false as const, error: error.message };
  if (data && printRequestBefore?.priority === "urgent") {
    const { data: printRequestAfter, error: priorityError } = await admin
      .from("print_requests")
      .select("priority, urgent_fallback_at")
      .eq("id", printRequestBefore.id)
      .maybeSingle();
    if (priorityError) return { ok: false as const, error: `Payment was verified, but queue priority could not be confirmed: ${priorityError.message}` };
    if (printRequestAfter?.priority === "normal" && printRequestAfter.urgent_fallback_at) {
      await notifyUrgentPrintFallback(
        printRequestBefore.student_id,
        printRequestBefore.id,
        printRequestBefore.request_number,
      );
    }
  }
  return data ? { ok: true as const } : { ok: false as const, error: "This payment is no longer pending." };
}
