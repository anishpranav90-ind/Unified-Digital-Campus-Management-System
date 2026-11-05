import Link from "next/link";
import { redirect } from "next/navigation";
import { CashierVerification } from "@/components/ecafe/cashier-verification";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { isDemoMode } from "@/lib/env";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "e-Cafe cashier" };

export default async function CashierPage() {
  const profile = await requireProfile();
  if (profile.role !== "faculty" && profile.role !== "admin") redirect("/ecafe");

  return (
    <div className="space-y-5">
      <Link href="/ecafe" className="text-xs font-semibold text-brand-blue hover:underline">
        Back to e-Cafe
      </Link>
      <PageHeader
        eyebrow="e-Cafe staff"
        title="Cashier verification"
        description="Scan the student's cash QR, verify the itemized order and exact amount, then confirm only after collecting cash."
        actions={<RealtimeRefresh demo={isDemoMode()} table="ecafe_orders" channelKey="ecafe-kitchen" label="Queue live" />}
      />
      <Card>
        <CardHeader
          title="Window A · Cash received"
          description="Unpaid orders stay out of the kitchen until you confirm payment."
        />
        <div className="p-5">
          <CashierVerification />
        </div>
      </Card>
    </div>
  );
}
