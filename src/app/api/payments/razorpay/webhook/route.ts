import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { razorpayWebhookPOST } from "@/lib/payments/razorpay-webhook-endpoint";

// The webhook endpoint only exists once Supabase is connected. This route
// explicitly enforces it: an unauthenticated request is refused before the
// shared application middleware runs, so payment settlement cannot be bypassed
// by calling the route directly.

export const POST = razorpayWebhookPOST;
