"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-state";
import {
  isPendingTotpFactor,
  isVerifiedTotpFactor,
  mfaErrorMessage,
  nextFactorName,
  safeNextPath,
} from "@/lib/auth/mfa";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mfaFactorSchema, mfaVerifySchema } from "@/lib/validations";

export type MfaEnrollmentState = {
  error?: string;
  enrollment?: {
    factorId: string;
    uri: string;
    secret: string;
  };
};

export async function beginMfaEnrollmentAction(): Promise<MfaEnrollmentState> {
  if (isDemoMode()) {
    return { error: "Authenticator setup is unavailable in demo mode." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again to continue." };

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { error: mfaErrorMessage(factorsError) };
  const allFactors = factorsData?.all ?? [];

  // Remove abandoned, unverified factors before starting another enrollment.
  // Supabase may reject this at AAL1; the real limit remains server-enforced.
  for (const factor of allFactors.filter(isPendingTotpFactor)) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: nextFactorName(allFactors),
  });

  if (error || !data || data.type !== "totp") {
    return { error: mfaErrorMessage(error) };
  }

  return {
    enrollment: {
      factorId: data.id,
      uri: data.totp.uri,
      secret: data.totp.secret,
    },
  };
}

export async function verifyMfaEnrollmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (isDemoMode()) return { error: "Authenticator setup is unavailable in demo mode." };

  const parsed = mfaVerifySchema.safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code from your app." };
  }
  const next = safeNextPath(String(formData.get("next") ?? ""), "/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again to continue." };

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { error: mfaErrorMessage(factorsError) };

  const factor = factorsData?.all.find(
    (item) => item.id === parsed.data.factorId && item.factor_type === "totp",
  );
  if (!factor) {
    return { error: "This authenticator setup is no longer available. Start the setup again." };
  }

  const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challenge.error || !challenge.data) {
    return { error: mfaErrorMessage(challenge.error) };
  }

  const verification = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.data.id,
    code: parsed.data.code,
  });
  if (verification.error) return { error: mfaErrorMessage(verification.error) };

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2") {
    return { error: "The code was accepted, but this session did not reach AAL2. Sign in again." };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function verifyMfaLoginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (isDemoMode()) return { error: "Authenticator verification is unavailable in demo mode." };

  const parsed = mfaVerifySchema.safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code from your app." };
  }
  const next = safeNextPath(String(formData.get("next") ?? ""), "/dashboard");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again to continue." };

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.data?.currentLevel === "aal2") redirect(next);

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { error: mfaErrorMessage(factorsError) };

  const factor = factorsData?.all.find(
    (item) =>
      item.id === parsed.data.factorId &&
      item.factor_type === "totp" &&
      item.status === "verified",
  );
  if (!factor) {
    return { error: "That authenticator is no longer enrolled. Sign in again to continue." };
  }

  const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challenge.error || !challenge.data) {
    return { error: mfaErrorMessage(challenge.error) };
  }

  const verification = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.data.id,
    code: parsed.data.code,
  });
  if (verification.error) return { error: mfaErrorMessage(verification.error) };

  const confirmed = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (confirmed.error || confirmed.data?.currentLevel !== "aal2") {
    return { error: "The code was accepted, but this session did not reach AAL2. Sign in again." };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function unenrollMfaAction(formData: FormData) {
  if (isDemoMode()) redirect("/dashboard");

  const parsed = mfaFactorSchema.safeParse({ factorId: formData.get("factorId") });
  if (!parsed.success) manageError("Choose a valid authenticator.");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mfa/manage");

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2") redirect("/mfa");

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) manageError(mfaErrorMessage(factorsError));

  const factors = factorsData?.all ?? [];
  const factor = factors.find(
    (item) => item.id === parsed.data.factorId && item.factor_type === "totp",
  );
  if (!factor) manageError("That authenticator is no longer enrolled.");

  const verified = factors.filter(isVerifiedTotpFactor);
  if (factor.status === "verified" && verified.length <= 1) {
    manageError("Add another authenticator before removing the only one.");
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) manageError(mfaErrorMessage(error));

  revalidatePath("/mfa/manage");
  redirect("/mfa/manage?removed=1");
}

function manageError(message: string): never {
  redirect(`/mfa/manage?error=${encodeURIComponent(message)}`);
}
