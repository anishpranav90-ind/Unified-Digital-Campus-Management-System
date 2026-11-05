"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronUp, Clock3, FileText, Utensils } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Input } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type {
  EcafeTransactionDetails,
  PrintTransactionDetails,
  TransactionHistoryRecord,
} from "@/types";

type Category = "all" | "ecafe" | "printpulse";

interface HistoryResponse {
  transactions: TransactionHistoryRecord[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  error?: string;
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "All Transactions" },
  { value: "ecafe", label: "e-Cafe (Food)" },
  { value: "printpulse", label: "PrintPulse (Prints)" },
];

function isEcafeDetails(details: TransactionHistoryRecord["details"]): details is EcafeTransactionDetails {
  return "items" in details;
}

function isPrintDetails(details: TransactionHistoryRecord["details"]): details is PrintTransactionDetails {
  return "document_name" in details;
}

function statusTone(status: string, refunded = false): "blue" | "green" | "amber" | "red" | "slate" {
  if (refunded || status === "REFUNDED" || status === "refunded") return "amber";
  if (["COMPLETED", "completed"].includes(status)) return "green";
  if (["QUEUED", "PREPARING", "READY", "submitted", "queued", "processing", "ready", "VERIFIED_AND_QUEUED"].includes(status)) {
    return "blue";
  }
  if (["CANCELLED", "cancelled", "FAILED", "failed"].includes(status)) return "red";
  if (status === "PAYMENT_PENDING" || status === "payment_pending") return "amber";
  return "slate";
}

function paymentLabel(method: string | null) {
  if (!method || method === "none") return "Payment pending";
  if (method === "upi") return "UPI";
  if (method === "razorpay") return "Razorpay";
  if (method === "cash") return "Cash";
  return method.replaceAll("_", " ");
}

function TransactionCard({ transaction }: { transaction: TransactionHistoryRecord }) {
  const isEcafe = transaction.type === "ecafe";
  const details = transaction.details;
  const printDetails = !isEcafe && isPrintDetails(details) ? details : null;
  const refunded = printDetails?.payment_status === "refunded";
  const status = refunded ? "REFUNDED" : transaction.status.replaceAll("_", " ").toUpperCase();
  const ecafeItems = isEcafe && isEcafeDetails(details) ? details.items : [];
  const destination = isEcafe
    ? `/ecafe/order/${transaction.id}`
    : `/printpulse/${transaction.id}`;

  return (
    <article className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-ink">
              {isEcafe && isEcafeDetails(details) && details.token_number
                ? `Token #${String(details.token_number).padStart(3, "0")}`
                : transaction.reference}
            </h2>
            <Badge tone={isEcafe ? "teal" : "blue"}>{isEcafe ? "e-Cafe" : "PrintPulse"}</Badge>
            <Badge tone={statusTone(transaction.status, refunded)}>{status}</Badge>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
            <Clock3 className="h-3 w-3" />
            {formatDateTime(transaction.created_at)} · {transaction.reference}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted">Total amount</p>
          <p className="text-base font-bold text-ink">{formatCurrency(transaction.amount_paise / 100)}</p>
        </div>
      </div>

      {isEcafe && isEcafeDetails(details) ? (
        <div className="mt-4 rounded-xl bg-canvas p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <Utensils className="h-3 w-3" /> Items
          </p>
          <ul className="space-y-1.5">
            {ecafeItems.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 text-xs">
                <span className="text-ink">{item.quantity} × {item.name}</span>
                <span className="font-medium text-ink">
                  {formatCurrency(item.quantity * item.unit_price_paise / 100)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : printDetails ? (
        <div className="mt-4 rounded-xl bg-canvas p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <FileText className="h-3 w-3" /> Print configuration
          </p>
          <p className="truncate text-xs font-semibold text-ink" title={printDetails.document_name}>
            {printDetails.document_name}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {printDetails.pages} pages · {printDetails.copies} {printDetails.copies === 1 ? "copy" : "copies"} ·{" "}
            {printDetails.color_mode === "color" ? "Color" : "B&W"} ·{" "}
            {printDetails.sides === "double" ? "Double-sided" : "Single-sided"} · {printDetails.paper_size.toUpperCase()}
            {printDetails.page_range ? ` · Pages ${printDetails.page_range}` : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Badge tone={transaction.payment_method === "cash" ? "amber" : "slate"}>
          {paymentLabel(transaction.payment_method)}
        </Badge>
        <Link
          href={destination}
          className="focus-ring inline-flex h-8 items-center rounded-xl border border-line bg-white px-3 text-xs font-medium text-ink hover:bg-slate-50"
        >
          {isEcafe
            ? transaction.status === "READY"
              ? "View receipt / pickup QR"
              : "View order receipt"
            : "View print receipt"}
        </Link>
      </div>
    </article>
  );
}

export function TransactionHistory() {
  const [category, setCategory] = useState<Category>("all");
  const [searchInput, setSearchInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [filters, setFilters] = useState({
    category: "all" as Category,
    search: "",
    startDate: "",
    endDate: "",
    page: 0,
  });
  const [transactions, setTransactions] = useState<TransactionHistoryRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      type: filters.category,
      search: filters.search,
      page: String(filters.page),
    });
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);

    void fetch(`/api/profile/transactions?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as HistoryResponse;
        if (!response.ok) throw new Error(result.error ?? "Could not load transaction history.");
        setTransactions((current) =>
          filters.page === 0 ? result.transactions : [...current, ...result.transactions],
        );
        setHasMore(result.hasMore);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load transaction history.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTransactions([]);
    setLoading(true);
    setFilters({
      category,
      search: searchInput.trim(),
      startDate: startDateInput,
      endDate: endDateInput,
      page: 0,
    });
  }

  function changeCategory(value: Category) {
    setCategory(value);
    setTransactions([]);
    setLoading(true);
    setFilters((current) => ({ ...current, category: value, page: 0 }));
  }

  function loadMore() {
    setLoading(true);
    setFilters((current) => ({ ...current, page: current.page + 1 }));
  }

  return (
    <div>
      <div className="border-b border-line p-5">
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Transaction category">
          {CATEGORIES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={category === item.value}
              onClick={() => changeCategory(item.value)}
              className={`focus-ring rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                category === item.value
                  ? "bg-navy-900 text-white"
                  : "border border-line bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] md:items-end">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Search transactions</span>
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Order ID or item name"
              maxLength={100}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">From</span>
            <Input
              type="date"
              value={startDateInput}
              onChange={(event) => setStartDateInput(event.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">To</span>
            <Input
              type="date"
              value={endDateInput}
              onChange={(event) => setEndDateInput(event.target.value)}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={loading}>
            <CalendarDays className="h-3.5 w-3.5" /> Apply filters
          </Button>
        </form>
      </div>

      {error ? <Alert className="m-5" tone="error">{error}</Alert> : null}
      {transactions.length ? (
        <div className="divide-y divide-line">
          {transactions.map((transaction) => (
            <TransactionCard key={`${transaction.type}-${transaction.id}`} transaction={transaction} />
          ))}
        </div>
      ) : !loading && !error ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No transactions found"
          description="Try another category, search term or date range."
        />
      ) : loading ? (
        <p className="px-5 py-10 text-center text-xs text-muted">Loading transactions…</p>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center border-t border-line p-5">
          <Button type="button" variant="secondary" disabled={loading} onClick={loadMore}>
            {loading ? "Loading…" : "Load more"}
            {loading ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ) : null}
      {loading && transactions.length > 0 ? (
        <p className="border-t border-line px-5 py-3 text-center text-[10px] text-muted" role="status">
          Loading transactions…
        </p>
      ) : null}
    </div>
  );
}
