import { Clock, MapPin, UserRound } from "lucide-react";
import type { TimetableEntry } from "@/types";
import { formatTime, minutesFromTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui";

export function ScheduleList({ entries, emptyText = "No classes scheduled today." }: { entries: TimetableEntry[]; emptyText?: string }) {
  if (!entries.length) {
    return <EmptyState icon={<Clock className="h-5 w-5" />} title={emptyText} />;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <ul className="divide-y divide-line">
      {entries.map((entry) => {
        const start = minutesFromTime(entry.start_time);
        const end = minutesFromTime(entry.end_time);
        const live = nowMinutes >= start && nowMinutes <= end;
        const done = nowMinutes > end;
        return (
          <li
            key={entry.id}
            className={`flex items-start gap-3 px-5 py-3.5 ${live ? "bg-orange-50/50" : done ? "opacity-60" : ""}`}
          >
            <div className="w-16 shrink-0 pt-0.5">
              <p className="text-xs font-semibold text-ink">{formatTime(entry.start_time)}</p>
              <p className="text-[10px] text-muted">{formatTime(entry.end_time)}</p>
            </div>
            <span
              className="mt-0.5 h-9 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: entry.subject?.color ?? "#94a3b8" }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium text-ink">{entry.subject?.name ?? "Class"}</p>
                {live ? (
                  <span className="rounded-full bg-brand-orange px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Now
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {entry.classroom?.name ?? "TBD"} · {entry.classroom?.building ?? ""}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3 w-3" /> {entry.faculty?.full_name ?? "Faculty"}
                </span>
                <span className="rounded bg-slate-100 px-1 py-0.5 font-medium text-slate-500">
                  {entry.subject?.code}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
