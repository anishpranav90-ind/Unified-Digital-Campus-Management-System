import { Badge } from "@/components/ui";
import { MAINTENANCE_STATUS_META, PRINT_STATUS_META, OPPORTUNITY_CATEGORIES } from "@/lib/constants";

type Tone = "slate" | "blue" | "green" | "amber" | "red" | "teal" | "orange" | "navy";

export function PrintStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = PRINT_STATUS_META[status] ?? { label: status, tone: "slate" };
  return (
    <Badge tone={meta.tone as Tone} className={className}>
      {meta.label}
    </Badge>
  );
}

export function MaintenanceStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = MAINTENANCE_STATUS_META[status] ?? { label: status, tone: "slate" };
  return (
    <Badge tone={meta.tone as Tone} className={className}>
      {meta.label}
    </Badge>
  );
}

export function OpportunityCategoryBadge({ category }: { category: string }) {
  const meta = OPPORTUNITY_CATEGORIES.find((item) => item.value === category);
  const tones: Record<string, Tone> = {
    hackathon: "orange",
    internship: "blue",
    workshop: "teal",
    technical_event: "blue",
    competition: "amber",
    seminar: "slate",
    placement: "green",
    scholarship: "green",
  };
  return <Badge tone={tones[category] ?? "slate"}>{meta?.label ?? category.replace("_", " ")}</Badge>;
}
