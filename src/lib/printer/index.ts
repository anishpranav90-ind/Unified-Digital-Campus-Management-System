import "server-only";

/**
 * Printer integration boundary.
 *
 * UniSync never claims a document was physically printed unless a real adapter
 * confirms it. The CUPS/IPP adapter is intentionally unimplemented: configure
 * and test it against a real print server before switching PRINTER_MODE=cups.
 */

export type PrinterJob = {
  requestNumber: string;
  filePath: string | null;
  pages: number;
  copies: number;
  colorMode: "bw" | "color";
  sides: "single" | "double";
};

export type PrintReceipt = {
  mode: "simulated" | "cups";
  physical: boolean;
  message: string;
};

export interface PrinterAdapter {
  mode: "simulated" | "cups";
  isAvailable(): boolean;
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

  isAvailable() {
    return false;
  }

  async submit(): Promise<PrintReceipt> {
    throw new Error(
      "CUPS/IPP is not configured. Install and test a CUPS/IPP adapter and set PRINTER_MODE=cups before marking jobs ready.",
    );
  }
}

export function getPrinterAdapter(mode: "simulated" | "cups"): PrinterAdapter {
  return mode === "cups" ? new CupsPrinter() : new SimulatedPrinter();
}
