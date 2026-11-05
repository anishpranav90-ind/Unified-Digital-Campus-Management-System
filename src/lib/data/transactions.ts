import "server-only";
import type {
  EcafeOrder,
  PrintRequest,
  Profile,
  TransactionHistoryRecord,
} from "@/types";
import { getDemoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const TRANSACTION_PAGE_SIZE = 10;

export interface TransactionHistoryFilters {
  type: "all" | "ecafe" | "printpulse";
  search: string;
  startDate: string | null;
  endDate: string | null;
  page: number;
}

export interface TransactionHistoryPage {
  transactions: TransactionHistoryRecord[];
  hasMore: boolean;
  page: number;
  pageSize: number;
}

function isWithinDateRange(value: string, startDate: string | null, endDate: string | null) {
  const date = value.slice(0, 10);
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function listDemoTransactions(
  profile: Profile,
  filters: TransactionHistoryFilters,
): TransactionHistoryRecord[] {
  const store = getDemoStore();
  const search = filters.search.trim().toLocaleLowerCase();
  const records: TransactionHistoryRecord[] = [];

  if (filters.type === "all" || filters.type === "ecafe") {
    for (const order of store.ecafe_orders.filter((item) => item.user_id === profile.id)) {
      if (!isWithinDateRange(order.created_at, filters.startDate, filters.endDate)) continue;
      const searchable = `${order.order_number} ${order.items.map((item) => item.name).join(" ")}`.toLocaleLowerCase();
      if (search && !searchable.includes(search)) continue;
      records.push(ecafeTransaction(order));
    }
  }

  if (filters.type === "all" || filters.type === "printpulse") {
    for (const request of store.print_requests.filter((item) => item.student_id === profile.id)) {
      if (!isWithinDateRange(request.created_at, filters.startDate, filters.endDate)) continue;
      const searchable = `${request.request_number} ${request.document_name}`.toLocaleLowerCase();
      if (search && !searchable.includes(search)) continue;
      records.push(printTransaction(request));
    }
  }

  return records.sort((left, right) =>
    right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id),
  );
}

function ecafeTransaction(order: EcafeOrder): TransactionHistoryRecord {
  return {
    type: "ecafe",
    id: order.id,
    reference: order.order_number,
    created_at: order.created_at,
    status: order.status,
    payment_method: order.payment_method ?? null,
    amount_paise: order.amount_paise,
    details: {
      token_number: order.token_number ?? null,
      items: order.items,
      is_express: order.is_express === true,
    },
  };
}

function printTransaction(request: PrintRequest): TransactionHistoryRecord {
  return {
    type: "printpulse",
    id: request.id,
    reference: request.request_number,
    created_at: request.created_at,
    status: request.status,
    payment_method: request.payment_method && request.payment_method !== "none"
      ? request.payment_method
      : request.payment_option,
    amount_paise: Math.round(Number(request.estimated_cost) * 100),
    details: {
      document_name: request.document_name,
      pages: request.pages,
      paper_size: request.paper_size,
      page_range: request.page_range,
      copies: request.copies,
      color_mode: request.color_mode,
      sides: request.sides,
      payment_status: request.payment_status,
      file_size: request.file_size,
    },
  };
}

export async function listTransactionHistory(
  profile: Profile,
  filters: TransactionHistoryFilters,
): Promise<TransactionHistoryPage> {
  const offset = filters.page * TRANSACTION_PAGE_SIZE;

  if (isDemoMode()) {
    const records = listDemoTransactions(profile, filters);
    const pageRecords = records.slice(offset, offset + TRANSACTION_PAGE_SIZE + 1);
    return {
      transactions: pageRecords.slice(0, TRANSACTION_PAGE_SIZE),
      hasMore: pageRecords.length > TRANSACTION_PAGE_SIZE,
      page: filters.page,
      pageSize: TRANSACTION_PAGE_SIZE,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_my_transaction_history", {
    p_type: filters.type,
    p_search: filters.search.trim(),
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_limit: TRANSACTION_PAGE_SIZE + 1,
    p_offset: offset,
  });
  if (error) throw new Error(`Could not load transaction history: ${error.message}`);

  const records = (data ?? []) as TransactionHistoryRecord[];
  return {
    transactions: records.slice(0, TRANSACTION_PAGE_SIZE).map((record) => ({
      ...record,
      amount_paise: Number(record.amount_paise),
    })),
    hasMore: records.length > TRANSACTION_PAGE_SIZE,
    page: filters.page,
    pageSize: TRANSACTION_PAGE_SIZE,
  };
}
