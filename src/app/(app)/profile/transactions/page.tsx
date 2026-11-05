import { ReceiptText } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { TransactionHistory } from "@/components/profile/transaction-history";
import { requireProfile } from "@/lib/session";

export const metadata = { title: "Transaction History" };

export default async function TransactionHistoryPage() {
  await requireProfile();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Transaction History"
        description="Search and track your PrintPulse jobs and e-Cafe orders in one place."
        actions={<ReceiptText className="h-5 w-5 text-muted" />}
      />
      <Card>
        <TransactionHistory />
      </Card>
    </div>
  );
}
