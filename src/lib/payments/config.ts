import "server-only";
import { isDemoMode } from "@/lib/env";
import type { PaymentMethod } from "@/types";

export type PaymentMethodAvailability = Record<
  PaymentMethod,
  { available: boolean; reason?: string }
>;

export function getPaymentMethodAvailability(): PaymentMethodAvailability {
  const upiVpa = process.env.UPI_PAYEE_VPA;
  const upiConfigured = Boolean(upiVpa && /^[\w.-]+@[\w.-]+$/.test(upiVpa));
  // Razorpay checkout is only available in Supabase-backed mode. Each half of
  // the provider config is checked so a partial setup gives one clear reason
  // instead of flipping availability at runtime:
  //   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET + demo off
  //   SUPABASE_SERVICE_ROLE_KEY (server-only; scripts may fall back to DB URL)
  const razorpayConfigured =
    !isDemoMode() &&
    Boolean(
      process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET &&
        process.env.RAZORPAY_WEBHOOK_SECRET &&
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

  return {
    upi: {
      available: upiConfigured,
      reason: "UPI is unavailable until the campus UPI_PAYEE_VPA is configured on the server.",
    },
    razorpay: {
      available: razorpayConfigured,
      reason: isDemoMode()
        ? "Razorpay checkout requires a connected Supabase project and webhook settlement configuration."
        : "Razorpay settlement is not configured on the server. Check RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, and SUPABASE_SERVICE_ROLE_KEY.",
    },
    cash: { available: true },
  };
}
