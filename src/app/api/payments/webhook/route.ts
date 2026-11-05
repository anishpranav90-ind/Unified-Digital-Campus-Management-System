import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { razorpayWebhookPOST } from "@/lib/payments/razorpay-webhook-endpoint";

// The webhook endpoint exists only after Supabase is connected. This route
// enforces the same boundary: an unauthenticated request is refused before the
// shared application middleware runs, so payment settlement cannot be reached
// through a direct webhook call with an empty or broken Supabase setup.
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Payment settlement is not configured. Connect Supabase and retry.",
      },
      { status: 401 },
    );
  }

  return razorpayWebhookPOST(request);
}
