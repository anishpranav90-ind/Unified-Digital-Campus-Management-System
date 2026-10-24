"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function RealtimeRefresh({
  demo,
  table,
  channelKey,
  label = "Live",
}: {
  demo: boolean;
  table: string;
  channelKey: string;
  label?: string;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(demo);

  useEffect(() => {
    if (demo) {
      const interval = setInterval(() => router.refresh(), 10000);
      return () => clearInterval(interval);
    }

    const supabase = getBrowserSupabase();
    const channel = supabase.channel(`unisync-${channelKey}`);
    channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
      router.refresh();
    });
    channel.subscribe((status: string) => setConnected(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demo, router, table, channelKey]);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-slate-500"
      title={demo ? "Demo mode refreshes with polling instead of Supabase Realtime" : "Connected to Supabase Realtime"}
    >
      <Radio className={`h-3 w-3 ${connected ? "text-emerald-500" : "text-slate-400"}`} />
      {label}
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} />
    </span>
  );
}
