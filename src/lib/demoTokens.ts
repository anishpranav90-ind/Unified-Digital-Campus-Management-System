import type { EcafeQueueBoardEntry } from "@/types";

export interface DemoToken extends EcafeQueueBoardEntry {
  items: string;
  paymentMethod: string;
  location: string | null;
}

export const DEMO_TOKENS: DemoToken[] = [
  {
    service_date: "demo",
    token_number: 40,
    is_express: false,
    status: "READY",
    items: "Paneer Roll (1x)",
    paymentMethod: "Cash",
    location: "Window B",
  },
  {
    service_date: "demo",
    token_number: 41,
    is_express: false,
    status: "READY",
    items: "Veg Sandwich (1x), Cold Coffee (1x)",
    paymentMethod: "UPI",
    location: "Window B",
  },
  {
    service_date: "demo",
    token_number: 42,
    is_express: false,
    status: "PREPARING",
    items: "Masala Dosa (2x), Tea (1x)",
    paymentMethod: "UPI",
    location: null,
  },
  {
    service_date: "demo",
    token_number: 43,
    is_express: true,
    status: "PREPARING",
    items: "Samosa (2x)",
    paymentMethod: "Cash",
    location: null,
  },
  {
    service_date: "demo",
    token_number: 44,
    is_express: false,
    status: "QUEUED",
    items: "Chicken Biryani (1x)",
    paymentMethod: "UPI",
    location: null,
  },
  {
    service_date: "demo",
    token_number: 45,
    is_express: false,
    status: "QUEUED",
    items: "Cold Coffee (1x)",
    paymentMethod: "Cash (Pending Scan)",
    location: null,
  },
];

export function getDemoTokens(): DemoToken[] {
  return DEMO_TOKENS.map((token) => ({ ...token }));
}
