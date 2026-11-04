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
        ? "Razorpay checkout requires a connected Supabase project."
        : "Razorpay settlement is not configured on the server.",
    },
    cash: { available: true },
  };
}
