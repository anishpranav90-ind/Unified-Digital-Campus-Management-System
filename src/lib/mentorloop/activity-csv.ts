export type MentorActivityCategory = "tech" | "research" | "culturals" | "sports";
export type MentorActivityType =
  | "google_form_submission"
  | "hackathon_registration"
  | "paper_publication"
  | "other";

export interface ImportedMentorActivity {
  student_email: string;
  category: MentorActivityCategory;
  activity_type: MentorActivityType;
  title: string;
  source: string;
  source_record_id: string;
  occurred_at: string;
  proof_url: string | null;
}

const REQUIRED_HEADERS = [
  "student_email",
  "category",
  "activity_type",
  "title",
  "source",
  "source_record_id",
  "occurred_at",
  "proof_url",
] as const;

const CATEGORIES = new Set<MentorActivityCategory>(["tech", "research", "culturals", "sports"]);
const ACTIVITY_TYPES = new Set<MentorActivityType>([
  "google_form_submission",
  "hackathon_registration",
  "paper_publication",
  "other",
]);

export function normalizeSafeProofUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !hostname.includes(".") ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
      hostname.startsWith("[")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function parseRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else if (character === '"') {
      throw new Error("CSV contains a quote in an unquoted field.");
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseMentorActivityCsv(input: string) {
  let rows: string[][];
  try {
    rows = parseRows(input.replace(/^\uFEFF/, ""));
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "CSV format is invalid.",
    };
  }

  if (rows.length < 2) {
    return { ok: false as const, error: "CSV must include a header row and at least one activity." };
  }
  if (rows.length > 501) {
    return { ok: false as const, error: "Import up to 500 activity records at a time." };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  if (
    headers.length !== REQUIRED_HEADERS.length ||
    REQUIRED_HEADERS.some((header, index) => headers[index] !== header)
  ) {
    return {
      ok: false as const,
      error: `CSV headers must be exactly: ${REQUIRED_HEADERS.join(", ")}.`,
    };
  }

  const records: ImportedMentorActivity[] = [];
  const identifiers = new Set<string>();
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const cells = rows[rowIndex];
    if (cells.length !== REQUIRED_HEADERS.length) {
      return { ok: false as const, error: `Row ${rowNumber} must contain ${REQUIRED_HEADERS.length} columns.` };
    }
    const [
      rawEmail,
      rawCategory,
      rawType,
      rawTitle,
      rawSource,
      rawRecordId,
      rawOccurredAt,
      rawProofUrl,
    ] = cells.map((cell) => cell.trim());
    const student_email = rawEmail.toLowerCase();
    const category = rawCategory.toLowerCase() as MentorActivityCategory;
    const activity_type = rawType.toLowerCase() as MentorActivityType;
    const occurred = new Date(rawOccurredAt);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student_email)) {
      return { ok: false as const, error: `Row ${rowNumber} has an invalid student email.` };
    }
    if (!CATEGORIES.has(category)) {
      return { ok: false as const, error: `Row ${rowNumber} category must be tech, research, culturals, or sports.` };
    }
    if (!ACTIVITY_TYPES.has(activity_type)) {
      return {
        ok: false as const,
        error: `Row ${rowNumber} activity_type must be google_form_submission, hackathon_registration, paper_publication, or other.`,
      };
    }
    if (!rawTitle || rawTitle.length > 200 || !rawSource || rawSource.length > 120) {
      return { ok: false as const, error: `Row ${rowNumber} needs a title (≤200) and source (≤120 characters).` };
    }
    if (!rawRecordId || rawRecordId.length > 160) {
      return { ok: false as const, error: `Row ${rowNumber} needs a source_record_id (≤160 characters).` };
    }
    if (!Number.isFinite(occurred.getTime())) {
      return { ok: false as const, error: `Row ${rowNumber} has an invalid occurred_at date.` };
    }

    let proof_url: string | null = null;
    if (rawProofUrl) {
      proof_url = normalizeSafeProofUrl(rawProofUrl);
      if (!proof_url) {
        return { ok: false as const, error: `Row ${rowNumber} proof_url must be a valid HTTPS URL.` };
      }
    }

    const recordKey = `${student_email}\u0000${rawSource.toLowerCase()}\u0000${rawRecordId}`;
    if (identifiers.has(recordKey)) {
      return { ok: false as const, error: `Row ${rowNumber} duplicates a source and source_record_id in this file.` };
    }
    identifiers.add(recordKey);
    records.push({
      student_email,
      category,
      activity_type,
      title: rawTitle,
      source: rawSource,
      source_record_id: rawRecordId,
      occurred_at: occurred.toISOString(),
      proof_url,
    });
  }

  return { ok: true as const, records };
}
