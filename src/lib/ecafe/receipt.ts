import { z } from "zod";

const CafeReceiptSchema = z
  .object({
    orderId: z.string().regex(/^EC-[A-Z0-9]{8}$/),
    createdAt: z.string().datetime(),
    paymentMethod: z.enum(["cash", "upi"]),
    paymentStatus: z.enum(["cash_due", "upi_pending"]),
    items: z
      .array(
        z.object({
          itemId: z.string().min(1).max(64),
          name: z.string().min(1).max(100),
          quantity: z.number().int().min(1).max(99),
          unitPrice: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(20),
    total: z.number().int().positive(),
  })
  .refine(
    (receipt) =>
      receipt.total ===
      receipt.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    { path: ["total"], message: "Receipt total does not match its items." },
  );

export type CafeReceipt = z.infer<typeof CafeReceiptSchema>;

export function parseCafeReceipt(value: string): CafeReceipt | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    return null;
  }

  const parsed = CafeReceiptSchema.safeParse(decoded);
  return parsed.success ? parsed.data : null;
}

export function createCafeReceiptLink(receipt: CafeReceipt, origin: string) {
  const url = new URL("/ecafe/receipt", origin);
  url.searchParams.set("data", JSON.stringify(receipt));
  return url.toString();
}
