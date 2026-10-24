import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { globalSearch } from "@/lib/data/search";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ results: [] }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await globalSearch(profile, query);
  return NextResponse.json({ results });
}
