"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

export function QrScanner({ onScan }: { onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState("");

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let active = true;
    let stopScanner: (() => void) | undefined;
    const reader = new BrowserQRCodeReader();

    void reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (result && active) onScanRef.current(result.getText());
      })
      .then((controls) => {
        if (active) stopScanner = controls.stop;
        else controls.stop();
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not access a camera for QR scanning.");
        }
      });

    return () => {
      active = false;
      stopScanner?.();
    };
  }, []);

  return (
    <div className="space-y-2">
      <video ref={videoRef} className="aspect-video w-full rounded-xl bg-navy-950 object-cover" muted playsInline />
      {error ? <p className="text-[10px] text-amber-700">{error}</p> : null}
      {!error ? <p className="text-[10px] text-muted">Allow camera access and hold the payment QR in view.</p> : null}
    </div>
  );
}
