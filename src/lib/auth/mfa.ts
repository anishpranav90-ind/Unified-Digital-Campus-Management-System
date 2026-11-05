import "server-only";

import type { AuthError, Factor, User } from "@supabase/supabase-js";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const MFA_FRIENDLY_NAME = "UniSync authenticator";
export const MFA_CODE_HINT = "Enter the 6-digit code from your authenticator app.";
export const MFA_INVALID_MESSAGE = "Invalid authenticator code. Please try again.";
export const MFA_EXPIRED_MESSAGE = "That code expired. Try the next code from your app.";
export const MFA_REQUIRED_MESSAGE = "Verify your authenticator to continue.";

export type MfaState = {
  user: User | null;
  currentLevel: string | null;
  nextLevel: string | null;
  factors: Factor[];
  verifiedTotpFactors: Factor[];
  error: string | null;
};

const EMPTY_MFA_STATE: MfaState = {
  user: null,
  currentLevel: null,
  nextLevel: null,
  factors: [],
  verifiedTotpFactors: [],
  error: null,
};

export function isVerifiedTotpFactor(factor: Factor) {
  return factor.factor_type === "totp" && factor.status === "verified";
}

export function isPendingTotpFactor(factor: Factor) {
  return factor.factor_type === "totp" && factor.status === "unverified";
}

export async function getMfaState(): Promise<MfaState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_MFA_STATE;

  const [factorsResult, aalResult] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const factors = factorsResult.data?.all ?? [];
  const error = factorsResult.error ?? aalResult.error;

  return {
    user,
    currentLevel: aalResult.data?.currentLevel ?? null,
    nextLevel: aalResult.data?.nextLevel ?? null,
    factors,
    verifiedTotpFactors: factors.filter(isVerifiedTotpFactor),
    error: error ? mfaErrorMessage(error) : null,
  };
}

export async function hasAal2Session() {
  if (isDemoMode()) return true;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.currentLevel === "aal2";
}

export function mfaEntryPath(state: MfaState, next = "/dashboard") {
  const destination = safeNextPath(next);
  if (state.currentLevel === "aal2") return destination;
  if (state.verifiedTotpFactors.length > 0) {
    return `/mfa/verify?next=${encodeURIComponent(destination)}`;
  }
  return `/mfa/setup?next=${encodeURIComponent(destination)}`;
}

/**
 * Only allow same-origin app paths. Authentication pages are excluded so a
 * tampered `next` value cannot create a redirect loop or return to sign-in.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  const candidate = (value ?? "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }
  if (/[\r\n]/.test(candidate)) return fallback;
  if (candidate === "/login" || candidate.startsWith("/login?") || candidate.startsWith("/auth/")) {
    return fallback;
  }
  if (candidate.startsWith("/mfa") && candidate !== "/mfa/manage") {
    return fallback;
  }
  return candidate;
}

export function nextFactorName(factors: Factor[]) {
  const used = new Set(factors.map((factor) => factor.friendly_name ?? ""));
  let index = factors.length + 1;
  let name = `${MFA_FRIENDLY_NAME} ${index}`;
  while (used.has(name)) {
    index += 1;
    name = `${MFA_FRIENDLY_NAME} ${index}`;
  }
  return name;
}

export function mfaErrorMessage(
  error: Pick<AuthError, "code" | "message" | "status"> | null | undefined,
) {
  if (!error) return "We could not complete that authenticator request. Please try again.";

  if (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "mfa_recovery_codes_locked"
  ) {
    return "Too many authenticator attempts. Wait a minute and try again.";
  }

  switch (error.code) {
    case "mfa_verification_failed":
      return MFA_INVALID_MESSAGE;
    case "mfa_challenge_expired":
      return MFA_EXPIRED_MESSAGE;
    case "mfa_factor_not_found":
      return "That authenticator is no longer available. Sign in again to continue.";
    case "too_many_enrolled_mfa_factors":
      return "You have reached the maximum number of authenticators. Remove one before adding another.";
    case "mfa_totp_enroll_not_enabled":
      return "Authenticator setup is disabled for this project. Contact the campus administrator.";
    case "mfa_totp_verify_not_enabled":
      return "Authenticator verification is disabled for this project. Contact the campus administrator.";
    case "insufficient_aal":
      return "Verify an authenticator before managing two-factor authentication.";
    case "mfa_ip_address_mismatch":
      return "This sign-in changed networks. Sign in again and retry the authenticator code.";
    default:
      return error.message || "We could not complete that authenticator request. Please try again.";
  }
}
