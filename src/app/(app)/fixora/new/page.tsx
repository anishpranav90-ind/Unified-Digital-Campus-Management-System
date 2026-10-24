import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { MaintenanceForm } from "./maintenance-form";

export const metadata = { title: "Report an issue" };

export default async function NewComplaintPage() {
  const profile = await requireProfile();
  if (profile.role !== "student") redirect("/fixora");

  return (
    <div>
      <Link
        href="/fixora"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Fixora
      </Link>
      <PageHeader
        eyebrow="Fixora · Campus maintenance"
        title="Report a campus issue"
        description="Give the facilities team enough detail to act quickly. You can track every update."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Complaint details"
            description="Photos help the maintenance team triage faster"
            icon={<Wrench className="h-4 w-4" />}
          />
          <div className="p-5">
            <MaintenanceForm />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-semibold text-ink">What happens next?</p>
            <ol className="mt-3 space-y-3 text-[11px] text-muted">
              {[
                "Your complaint is logged as Submitted with a unique FX- ID.",
                "Facilities reviews it and sets a priority.",
                "A staff member is assigned and work moves to In Progress.",
                "You get notified at every status change until it is Resolved.",
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[9px] font-bold text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold text-ink">Photo access</p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
              Photos are stored in the private <code>maintenance-photos</code> bucket. Only you, assigned
              staff and administrators can access them.
              {isDemoMode() ? " Demo mode stores metadata only." : ""}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
