import Link from "next/link";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { listEcafeQueueBoard } from "@/lib/data/ecafe";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import { EcafeTokenBoard } from "@/components/ecafe/ecafe-token-board";

export const metadata = { title: "e-Cafe token board" };

export default async function EcafeBoardPage() {
  await requireProfile();
  const entries = await listEcafeQueueBoard();
  const demo = isDemoMode();

  return (
    <div className="space-y-5">
      <Link href="/ecafe" className="text-xs font-semibold text-brand-blue hover:underline">
        Back to e-Cafe
      </Link>
      <PageHeader
        eyebrow="Live campus dining"
        title="e-Cafe token board"
        description="Follow your token on the live board. Come to the pickup counter only when it is marked READY."
        actions={
          <RealtimeRefresh
            demo={demo}
            table="ecafe_queue_board"
            channelKey="ecafe-token-board"
            label="Live token updates"
          />
        }
      />

      <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
        <Radio className="h-4 w-4 shrink-0" />
        <span>Payment-verified orders only. Express items are labelled and kept in their own FIFO lane.</span>
      </div>

      <EcafeTokenBoard entries={entries} demo={demo} />
    </div>
  );
}
