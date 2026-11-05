"use client";

import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { QrScanner } from "@/components/payments/qr-scanner";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { redeemEcafePickupAction } from "@/lib/actions/ecafe";

function playSuccessChime() {
  try {
    const audio = new window.AudioContext();
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.frequency.value = 880;
    volume.gain.setValueAtTime(0.12, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
    oscillator.connect(volume);
    volume.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.35);
    oscillator.onended = () => void audio.close();
  } catch (error) {
    console.error("Could not play the e-Cafe pickup chime.", error);
  }
}

export function EcafePickupScanner() {
  const [state, formAction, pending] = useActionState(redeemEcafePickupAction, EMPTY_FORM_STATE);
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (state.result?.completed) playSuccessChime();
  }, [state.result?.completed, state.result?.order_number]);

  return (
    <div className="space-y-4 p-5">
      <p className="text-xs text-muted">
        Scan a ready order&apos;s pickup QR at Window B. Early scans are blocked and show the queue position.
      </p>
      <form action={formAction} className="space-y-3">
        <QrScanner onScan={setQr} />
        <Field label="Pickup QR value" htmlFor="ecafe-pickup-qr">
          <Input
            id="ecafe-pickup-qr"
            name="qr"
            value={qr}
            onChange={(event) => setQr(event.target.value)}
            placeholder="Scan or paste the student's pickup QR"
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="accent" size="sm" disabled={pending || !qr}>
          {pending ? "Checking order…" : "Verify pickup and complete"}
        </Button>
      </form>

      {state.error && state.result?.found && !state.result.completed ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="ecafe-not-ready-title">
          <Card className="w-full max-w-sm border-amber-200 p-5 shadow-lift">
            <h2 id="ecafe-not-ready-title" className="text-base font-bold text-amber-900">
              Order Not Ready Yet!
            </h2>
            <p className="mt-2 text-sm text-amber-800">
              Current queue position: <strong>{state.result.queue_position ?? 0}</strong>
            </p>
            <p className="mt-1 text-xs text-muted">
              Token #{String(state.result.token_number ?? 0).padStart(3, "0")} · {state.result.order_status}
            </p>
            <Button className="mt-4" size="sm" onClick={() => setQr("")}>
              Scan another order
            </Button>
          </Card>
        </div>
      ) : state.error ? (
        <Alert tone="error">{state.error}</Alert>
      ) : null}

      {state.result?.completed ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
          <p className="text-sm font-bold text-emerald-900">
            Token #{String(state.result.token_number ?? 0).padStart(3, "0")} handed over
          </p>
          <p className="mt-1 text-xs text-emerald-800">{state.result.order_number}</p>
          <p className="mt-3 text-xs font-semibold text-emerald-900">Items to hand over</p>
          <ul className="mt-1 list-inside list-disc text-xs text-emerald-800">
            {state.result.items?.map((item) => (
              <li key={item.id}>{item.quantity} × {item.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
