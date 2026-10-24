"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/action-state";
import { requireRole } from "@/lib/session";
import { roleSchema } from "@/lib/validations";
import { updateUserRole } from "@/lib/data/admin";

export async function updateUserRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole(["admin"]);
  const parsed = roleSchema.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Choose a valid role." };
  const result = await updateUserRole(admin, parsed.data.user_id, parsed.data.role);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/users");
  return { success: "Role updated. The change is recorded in the audit log." };
}
