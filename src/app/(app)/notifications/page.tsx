import Link from "next/link";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { listNotifications } from "@/lib/data/notifications";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Notifications" };

const TYPE_TONE: Record<string, "blue" | "teal" | "orange" | "green" | "amber" | "slate"> = {
  announcement: "blue",
  timetable: "slate",
  print: "orange",
  message: "teal",
  opportunity: "amber",
  maintenance: "green",
  system: "slate",
};

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const notifications = await listNotifications(profile, 100);
  const unread = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div>
      <PageHeader
        eyebrow="Stay in sync"
        title="Notifications"
        description="Every alert is stored in PostgreSQL so you can catch up later."
        actions={
          <div className="flex items-center gap-2">
            <RealtimeRefresh demo={isDemoMode()} table="notifications" channelKey={`notifications-page-${profile.id}`} />
            <form action={markAllNotificationsReadAction}>
              <Button size="sm" variant="secondary" disabled={unread === 0}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </Button>
            </form>
          </div>
        }
      />

      <Card>
        <CardHeader
          title="Notification history"
          description={`${unread} unread of ${notifications.length}`}
          icon={<Bell className="h-4 w-4" />}
        />
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-5 w-5" />}
            title="No notifications yet"
            description="Announcements, print updates and complaint changes will appear here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`flex flex-wrap items-start gap-3 px-5 py-4 ${
                  notification.is_read ? "" : "bg-blue-50/30"
                }`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    notification.is_read ? "bg-slate-200" : "bg-brand-orange"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{notification.title}</p>
                    <Badge tone={TYPE_TONE[notification.type] ?? "slate"}>{notification.type}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{notification.body}</p>
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    {formatDateTime(notification.created_at)} · {timeAgo(notification.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {notification.link ? (
                    <Link
                      href={notification.link}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-semibold text-brand-blue hover:bg-blue-50"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null}
                  {!notification.is_read ? (
                    <form action={markNotificationReadAction.bind(null, notification.id)}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <CheckCheck className="h-3 w-3" /> Read
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
