import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { getPrintFileUrl, getPrintRequest } from "@/lib/data/printpulse";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const printRequest = await getPrintRequest(profile, id);
  if (!printRequest?.file_path) {
    return NextResponse.json({ error: "Document not available." }, { status: 404 });
  }

  const url = await getPrintFileUrl(profile, printRequest.file_path);
  if (!url) return NextResponse.json({ error: "Could not create a signed URL." }, { status: 500 });
  return NextResponse.redirect(url);
}
