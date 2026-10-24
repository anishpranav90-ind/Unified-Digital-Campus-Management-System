import { Bell, Check, Megaphone } from "lucide-react";
import type { Announcement } from "@/types";
import { formatDate, timeAgo } from "@/lib/utils";
import { Badge, EmptyState } from "@/components/ui";
import { markAnnouncementReadAction } from "@/lib/actions/announcements";

const CATEGORY_TONE: Record<string, "blue" | "amber" | "red" | "teal" | "slate"> = {
  general: "slate",
  academic: "blue",
  exam: "amber",
  event: "teal",
  urgent: "red",
};

export function AnnouncementsList({
  announcements,
  emptyTitle = "No announcements yet",
}: {
  announcements: Announcement[];
  emptyTitle?: string;
}) {
  if (!announcements.length) {
    return <EmptyState icon={<Megaphone className="h-5 w-5" />} title={emptyTitle} />;
  }

  return (
    <ul className="divide-y divide-line">
      {announcements.map((announcement) => (
        <li key={announcement.id} className="group flex gap-3 px-5 py-4">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              announcement.is_read ? "bg-slate-200" : "bg-brand-orange"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={CATEGORY_TONE[announcement.category] ?? "slate"}>{announcement.category}</Badge>
              <span className="text-[10px] text-muted">
                {announcement.author?.full_name ?? "Campus office"} · {timeAgo(announcement.published_at)}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-ink">{announcement.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{announcement.body}</p>
            <p className="mt-1.5 text-[10px] text-slate-400">{formatDate(announcement.published_at, "dd MMM yyyy, h:mm a")}</p>
          </div>
          {!announcement.is_read ? (
            <form action={markAnnouncementReadAction.bind(null, announcement.id)}>
              <button
                type="submit"
                className="focus-ring mt-1 inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-50"
                aria-label={`Mark ${announcement.title} as read`}
              >
                <Check className="h-3 w-3" /> Read
              </button>
            </form>
          ) : (
            <Bell className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-300" />
          )}
        </li>
      ))}
    </ul>
  );
}
