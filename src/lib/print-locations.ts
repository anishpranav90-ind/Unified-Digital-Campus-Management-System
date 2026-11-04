export const PRINT_LOCATION_IDS = [
  "sjit-girls-xerox-1",
  "sjit-boys-xerox-1",
  "sjce-boys-xerox-1",
  "sjce-girls-xerox-1",
  "sjit-periwinkle-xerox",
] as const;

export type PrintLocation = (typeof PRINT_LOCATION_IDS)[number];

export const PRINT_LOCATION_LABELS: Record<PrintLocation, string> = {
  "sjit-girls-xerox-1": "SJIT-Girls Xerox-1",
  "sjit-boys-xerox-1": "SJIT-Boys Xerox-1",
  "sjce-boys-xerox-1": "SJCE-Boys Xerox-1",
  "sjce-girls-xerox-1": "SJCE-Girls Xerox-1",
  "sjit-periwinkle-xerox": "SJIT-Periwinkle Xerox",
};

export function getPrintLocationLabel(location?: string | null) {
  return PRINT_LOCATION_LABELS[location as PrintLocation] ?? PRINT_LOCATION_LABELS[PRINT_LOCATION_IDS[0]];
}