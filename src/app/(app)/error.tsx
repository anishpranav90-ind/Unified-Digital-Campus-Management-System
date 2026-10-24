"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-16 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted">
        This module could not load its data. The rest of UniSync is still available.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-[10px] text-slate-400">Ref: {error.digest}</p> : null}
      <Button onClick={reset} className="mt-5">
        <RefreshCw className="h-4 w-4" /> Try again
      </Button>
    </Card>
  );
}
