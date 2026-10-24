import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { getPrintSettings } from "@/lib/data/printpulse";
import { PageHeader } from "@/components/ui";
import { PrintRequestForm } from "./print-request-form";

export const metadata = { title: "New print request" };

export default async function NewPrintRequestPage() {
  const profile = await requireProfile();
  if (profile.role !== "student") redirect("/printpulse");
  const settings = await getPrintSettings();

  return (
    <div>
      <Link
        href="/printpulse"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to PrintPulse
      </Link>
      <PageHeader
        eyebrow="PrintPulse"
        title="New print request"
        description="Upload a PDF, choose your print options and join the digital queue."
      />
      <PrintRequestForm settings={settings} />
    </div>
  );
}
