import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { listTransactionHistory } from "@/lib/data/transactions";
import type { TransactionHistoryFilters } from "@/lib/data/transactions";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE = 100_000;

function validDate(value: string | null) {
  if (!value) return null;
  if (!DATE_PATTERN.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to view transaction history." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const typeValue = params.get("type") ?? "all";
  if (typeValue !== "all" && typeValue !== "ecafe" && typeValue !== "printpulse") {
    return NextResponse.json({ error: "Choose a valid transaction category." }, { status: 400 });
  }

  const search = (params.get("search") ?? "").trim();
  if (search.length > 100) {
    return NextResponse.json({ error: "Search text must be 100 characters or fewer." }, { status: 400 });
  }
  const startDate = validDate(params.get("startDate"));
  const endDate = validDate(params.get("endDate"));
  if (startDate === undefined || endDate === undefined) {
    return NextResponse.json({ error: "Enter a valid date range." }, { status: 400 });
  }
  if (startDate && endDate && startDate > endDate) {
    return NextResponse.json({ error: "The start date must be on or before the end date." }, { status: 400 });
  }

  const rawPage = params.get("page") ?? "0";
  if (!/^\d+$/.test(rawPage)) {
    return NextResponse.json({ error: "Choose a valid history page." }, { status: 400 });
  }
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page) || page > MAX_PAGE) {
    return NextResponse.json({ error: "That history page is not available." }, { status: 400 });
  }

  const filters: TransactionHistoryFilters = {
    type: typeValue,
    search,
    startDate,
    endDate,
    page,
  };
  const result = await listTransactionHistory(profile, filters);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
