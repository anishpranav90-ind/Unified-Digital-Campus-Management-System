export type PrintPricing = {
  bw_single: number;
  bw_double: number;
  color_single: number;
  color_double: number;
  avg_processing_minutes: number;
  max_pages_per_job: number;
};

export const FALLBACK_PRICING: PrintPricing = {
  bw_single: 2,
  bw_double: 3,
  color_single: 5,
  color_double: 8,
  avg_processing_minutes: 4,
  max_pages_per_job: 100,
};

export const URGENT_PRINT_PRICE_MULTIPLIER = 1.5;

export function calculatePrintCost(
  settings: PrintPricing,
  input: {
    pages: number;
    copies: number;
    color_mode: "bw" | "color";
    sides: "single" | "double";
    priority?: "normal" | "urgent";
  },
) {
  const rate =
    input.color_mode === "color"
      ? input.sides === "double"
        ? settings.color_double
        : settings.color_single
      : input.sides === "double"
        ? settings.bw_double
        : settings.bw_single;
  const priorityMultiplier = input.priority === "urgent" ? URGENT_PRINT_PRICE_MULTIPLIER : 1;
  return Math.max(0, Math.round(rate * input.pages * input.copies * priorityMultiplier * 100) / 100);
}
