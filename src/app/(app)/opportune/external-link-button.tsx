"use client";

import { useState } from "react";
import { ExternalLink, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui";

export function ExternalLinkButton({
  url,
  label = "Apply on external site",
}: {
  url: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "external site";
  }

  return (
    <>
      <Button variant="accent" onClick={() => setOpen(true)}>
        {label} <ExternalLink className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/60 p-4 backdrop-blur-sm sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="external-link-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 id="external-link-title" className="mt-3 text-base font-semibold text-ink">
              You are leaving UniSync
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              This opportunity is hosted by an external organization. UniSync has validated the link format
              but does not control the destination or its privacy practices.
            </p>
            <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-[10px] text-slate-600">
              {url}
            </p>
            <p className="mt-2 text-[10px] text-muted">Destination: {host}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Stay on UniSync
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={() => {
                  window.open(url, "_blank", "noopener,noreferrer");
                  setOpen(false);
                }}
              >
                Continue to external site <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
