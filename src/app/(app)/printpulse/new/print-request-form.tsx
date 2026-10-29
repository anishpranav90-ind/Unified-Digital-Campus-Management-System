"use client";

import { useActionState, useState } from "react";
import { IndianRupee } from "lucide-react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPrintRequestAction } from "@/lib/actions/printpulse";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { calculatePrintCost } from "@/lib/print";
import { formatCurrency } from "@/lib/utils";
import { MAX_PDF_BYTES } from "@/lib/constants";
import type { PrintSettings } from "@/types";

export function PrintRequestForm({ settings }: { settings: PrintSettings }) {
  const [state, formAction] = useActionState(createPrintRequestAction, EMPTY_FORM_STATE);
  const [pages, setPages] = useState(1);
  const [copies, setCopies] = useState(1);
  const [colorMode, setColorMode] = useState<"bw" | "color">("bw");
  const [sides, setSides] = useState<"single" | "double">("double");
  const [fileLabel, setFileLabel] = useState("");

  const estimate = calculatePrintCost(settings, {
    pages: Number.isFinite(pages) ? pages : 0,
    copies: Number.isFinite(copies) ? copies : 0,
    color_mode: colorMode,
    sides,
  });

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card lg:col-span-2">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <Field label="Document name" htmlFor="document_name" required>
          <Input
            id="document_name"
            name="document_name"
            placeholder="e.g. DBMS Unit 3, Normalisation Notes"
            maxLength={120}
            required
          />
        </Field>

        <Field
          label="PDF document"
          htmlFor="file"
          hint={`PDF only · max 5 MB · up to ${settings.max_pages_per_job} pages per job`}
          required
        >
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return setFileLabel("");
                if (file.size > MAX_PDF_BYTES) {
                  setFileLabel("That file is larger than 5 MB.");
                  return;
                }
                setFileLabel(`${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
              }}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-navy-800"
            />
            {fileLabel ? <p className="mt-2 text-[10px] text-slate-500">{fileLabel}</p> : null}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Number of pages" htmlFor="pages" required>
            <Input
              id="pages"
              name="pages"
              type="number"
              min="1"
              max={settings.max_pages_per_job}
              value={pages}
              onChange={(event) => setPages(Number(event.target.value))}
              required
            />
          </Field>
          <Field label="Page range" htmlFor="page_range" hint="Optional, e.g. 1-10, 14">
            <Input id="page_range" name="page_range" placeholder="All pages" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Copies" htmlFor="copies" required>
            <Input
              id="copies"
              name="copies"
              type="number"
              min="1"
              max="20"
              value={copies}
              onChange={(event) => setCopies(Number(event.target.value))}
              required
            />
          </Field>
          <Field label="Priority" htmlFor="priority">
            <Select id="priority" name="priority" defaultValue="normal">
              <option value="normal">Normal queue</option>
              <option value="urgent">Urgent (print desk review)</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Color mode" htmlFor="color_mode" required>
            <Select
              id="color_mode"
              name="color_mode"
              value={colorMode}
              onChange={(event) => setColorMode(event.target.value as "bw" | "color")}
            >
              <option value="bw">Black & white</option>
              <option value="color">Color</option>
            </Select>
          </Field>
          <Field label="Sides" htmlFor="sides" required>
            <Select
              id="sides"
              name="sides"
              value={sides}
              onChange={(event) => setSides(event.target.value as "single" | "double")}
            >
              <option value="single">Single-sided</option>
              <option value="double">Double-sided</option>
            </Select>
          </Field>
        </div>

        <Field label="Notes for the print desk" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} placeholder="Collection time, binding instructions…" />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[10px] text-muted">
            Uploads go to the private <code>print-documents</code> bucket when Supabase Storage is connected.
          </p>
          <SubmitButton pendingText="Submitting…" variant="accent">
            Submit print request
          </SubmitButton>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-navy-950 p-5 text-white shadow-card">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <IndianRupee className="h-3.5 w-3.5 text-brand-orange" /> Estimated cost
          </p>
          <p className="mt-3 text-3xl font-semibold">{formatCurrency(estimate)}</p>
          <p className="mt-1 text-[10px] text-slate-400">
            {pages || 0} pages × {copies || 0} copies · {colorMode === "color" ? "color" : "B&W"} ·{" "}
            {sides}-sided
          </p>
          <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span>Rate used</span>
              <span>
                {formatCurrency(
                  colorMode === "color"
                    ? sides === "double"
                      ? settings.color_double
                      : settings.color_single
                    : sides === "double"
                      ? settings.bw_double
                      : settings.bw_single,
                )}{" "}
                / page
              </span>
            </div>
            <div className="flex justify-between">
              <span>Avg. processing</span>
              <span>{settings.avg_processing_minutes} min / job</span>
            </div>
            <div className="flex justify-between">
              <span>Payment</span>
              <span>Pay at the print desk</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[10px] leading-relaxed text-amber-800">
          <p className="font-semibold">Simulated printer mode</p>
          <p className="mt-1">
            No physical printer is connected in this environment. Your job moves through a digital queue and
            is clearly marked as simulated. UniSync will never claim a document physically printed.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4 text-[10px] leading-relaxed text-muted">
          <p className="font-semibold text-slate-700">Before you submit</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>The page count must match your actual PDF page count.</li>
            <li>Cancellation is allowed while the job is Submitted or Queued.</li>
            <li>Only you and print desk staff can access your document.</li>
          </ul>
        </div>
      </div>
    </form>
  );
}
