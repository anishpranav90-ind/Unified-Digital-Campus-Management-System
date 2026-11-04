import "server-only";
import ipp from "@objectif-lune/ipp";
import type { PrintLocation } from "@/lib/print-locations";
import { PRINT_LOCATION_LABELS } from "@/lib/print-locations";

/**
 * Printer integration boundary.
 *
 * Printer traffic stays on the server. CUPS acceptance is recorded separately
 * from print completion, which the print desk must confirm.
 */

export type PrinterJob = {
  requestNumber: string;
  printLocation: PrintLocation;
  filePath: string | null;
  pages: number;
  paperSize: "a4" | "a3" | "letter";
  pageRange: string | null;
  copies: number;
  colorMode: "bw" | "color";
  sides: "single" | "double";
  pdf: Buffer;
};

export type PrintReceipt = {
  mode: "simulated" | "cups";
  physical: boolean;
  message: string;
  printerJobId?: number;
};

export interface PrinterAdapter {
  mode: "simulated" | "cups";
  isAvailable(location?: PrintLocation): boolean;
  submit(job: PrinterJob): Promise<PrintReceipt>;
}

class SimulatedPrinter implements PrinterAdapter {
  mode = "simulated" as const;

  isAvailable() {
    return true;
  }

  async submit(job: PrinterJob): Promise<PrintReceipt> {
    return {
      mode: "simulated",
      physical: false,
      message: `Simulated output recorded for ${job.requestNumber}. No physical pages were printed.`,
    };
  }
}

class CupsPrinter implements PrinterAdapter {
  mode = "cups" as const;

  isAvailable(location?: PrintLocation) {
    return location ? getCupsConfig(location) !== null : false;
  }

  async submit(job: PrinterJob): Promise<PrintReceipt> {
    const config = getCupsConfig(job.printLocation);
    if (!config) {
      throw new Error(`Configure a valid IPP URI for ${PRINT_LOCATION_LABELS[job.printLocation]}.`);
    }

    const pageRanges = parsePageRanges(job.pageRange);
    const printer = ipp.Printer(config.uri, {
      uri: config.uri,
      timeout: 30_000,
      ...(config.auth ? { auth: config.auth } : {}),
    });
    const response = await printer.executeAsync("Print-Job", {
      "operation-attributes-tag": {
        "requesting-user-name": process.env.CUPS_REQUESTING_USER?.trim() || "unisync",
        "job-name": job.requestNumber,
        "document-format": "application/pdf",
      },
      "job-attributes-tag": {
        copies: job.copies,
        sides: job.sides === "double" ? "two-sided-long-edge" : "one-sided",
        "print-color-mode": job.colorMode === "color" ? "color" : "monochrome",
        media:
          job.paperSize === "a3"
            ? "iso_a3_297x420mm"
            : job.paperSize === "letter"
              ? "na_letter_8.5x11in"
              : "iso_a4_210x297mm",
        ...(pageRanges ? { "page-ranges": pageRanges } : {}),
      },
      data: job.pdf,
    });

    const statusCode = response["status-code"];
    if (typeof statusCode === "string" && !statusCode.startsWith("successful-")) {
      throw new Error(`CUPS rejected the print job (${statusCode}).`);
    }
    if (typeof statusCode === "number" && statusCode >= 0x0100) {
      throw new Error(`CUPS rejected the print job (IPP status ${statusCode}).`);
    }

    const jobAttributes = response["job-attributes-tag"];
    const printerJobId =
      typeof jobAttributes === "object" && jobAttributes !== null
        ? (jobAttributes as Record<string, unknown>)["job-id"]
        : undefined;
    if (typeof printerJobId !== "number" || !Number.isInteger(printerJobId) || printerJobId < 1) {
      throw new Error("CUPS accepted the request without returning a valid job ID.");
    }

    return {
      mode: "cups",
      physical: false,
      printerJobId,
      message: `CUPS accepted ${job.requestNumber} as job ${printerJobId}; print completion is not yet confirmed.`,
    };
  }
}

const CUPS_URI_VARIABLES: Record<PrintLocation, string> = {
  "sjit-girls-xerox-1": "CUPS_SJIT_GIRLS_XEROX_1_URI",
  "sjit-boys-xerox-1": "CUPS_SJIT_BOYS_XEROX_1_URI",
  "sjce-boys-xerox-1": "CUPS_SJCE_BOYS_XEROX_1_URI",
  "sjce-girls-xerox-1": "CUPS_SJCE_GIRLS_XEROX_1_URI",
  "sjit-periwinkle-xerox": "CUPS_SJIT_PERIWINKLE_XEROX_URI",
};

function getCupsConfig(location: PrintLocation) {
  const uri = process.env[CUPS_URI_VARIABLES[location]]?.trim();
  if (!uri) return null;

  try {
    const parsedUri = new URL(uri);
    if (parsedUri.protocol !== "ipp:" && parsedUri.protocol !== "ipps:") return null;

    const username = process.env.CUPS_USERNAME?.trim();
    const password = process.env.CUPS_PASSWORD;
    const auth = username && password ? { username, password } : undefined;
    if ((username || password) && (!auth || parsedUri.protocol !== "ipps:")) return null;

    return { uri, auth };
  } catch {
    return null;
  }
}

function parsePageRanges(value: string | null): { min: number; max: number }[] | null {
  if (!value?.trim()) return null;

  return value.split(",").map((part) => {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!match) throw new Error("Page ranges must use a format such as 1-3,5.");

    const min = Number(match[1]);
    const max = Number(match[2] ?? match[1]);
    if (min < 1 || max < min) throw new Error("Page ranges must contain positive, ascending page numbers.");
    return { min, max };
  });
}

export function getPrinterAdapter(mode: "simulated" | "cups"): PrinterAdapter {
  return mode === "cups" ? new CupsPrinter() : new SimulatedPrinter();
}
