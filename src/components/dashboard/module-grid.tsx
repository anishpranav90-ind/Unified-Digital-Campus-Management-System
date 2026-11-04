import Link from "next/link";
import { ArrowUpRight, CalendarDays, Coffee, MessagesSquare, Printer, Trophy, Wrench } from "lucide-react";
import { MODULES } from "@/lib/constants";

const ICONS = { Printer, CalendarDays, MessagesSquare, Trophy, Wrench, Coffee } as const;
const ACCENTS = [
  "bg-orange-50 text-brand-orange",
  "bg-blue-50 text-brand-blue",
  "bg-teal-50 text-brand-teal",
  "bg-amber-50 text-amber-600",
  "bg-emerald-50 text-emerald-600",
  "bg-orange-50 text-brand-orange",
];

export function ModuleGrid({ counts = {} }: { counts?: Record<string, string | number | undefined> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {MODULES.map((module, index) => {
        const Icon = ICONS[module.icon as keyof typeof ICONS];
        const count = counts[module.key];
        return (
          <Link
            key={module.key}
            href={module.href}
            className="group rounded-2xl border border-line bg-white p-4 shadow-card transition-shadow hover:shadow-lift"
          >
            <div className="flex items-start justify-between">
              <span className={`rounded-xl p-2 ${ACCENTS[index]}`}>
                <Icon className="h-4 w-4" />
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-slate-500" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">{module.name}</p>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">{module.tagline}</p>
            {count !== undefined ? (
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{count}</p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
