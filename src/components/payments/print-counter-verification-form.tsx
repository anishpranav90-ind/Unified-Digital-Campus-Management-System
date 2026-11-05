"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { verifyCounterPaymentAction } from "@/lib/actions/payments";
import { QrScanner } from "@/components/payments/qr-scanner";

export function PrintCounterVerificationForm() {
  const [state, formAction, pending] = useActionState(verifyCounterPaymentAction, EMPTY_FORM_STATE);
  const [qr, setQr] = useState("");
  const router = useRouter();

  return (
    <form action={formAction} className="space-y-3 p-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="qr" value={qr} />
      <QrScanner onScan={setQr} />
      <Field label="Scanned QR value" htmlFor="counter-qr">
        <Input
          id="counter-qr"
          value={qr}
          onChange={(event) => setQr(event.target.value)}
          placeholder="Or paste/type the scanned QR value"
          autoComplete="off"
        />
      </Field>
      <Field label="Payment method" htmlFor="counter-method" required>
        <Select id="counter-method" name="method" defaultValue="cash">
          <option value="cash">Cash received at counter</option>
          <option value="upi">UPI received (reference required)</option>
        </Select>
      </Field>
      <Field label="UPI reference / UTR" htmlFor="counter-reference" hint="Required for UPI; leave empty for cash.">
        <Input id="counter-reference" name="reference" maxLength={80} autoComplete="off" />
      </Field>
      <Button type="submit" variant="accent" size="sm" disabled={pending || !qr}>
        {pending ? "Verifying…" : "Verify payment"}
      </Button>
      {state.success ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => router.refresh()}>
          Refresh queue
        </Button>
      ) : null}
    </form>
  );
}
