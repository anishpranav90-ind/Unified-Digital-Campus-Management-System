"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import type { AppNotification } from "@/types";
import { timeAgo } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";

const TYPE_DOT: Record<string, string> = {
  announcement: "bg-blue-500",
  timetable: "bg-sky-500",
  print: "bg-orange-500",
  message: "bg-teal-500",
  opportunity: "bg-amber-500",
  maintenance: "bg-emerald-500",
  system: "bg-slate-400",
};

export function NotificationBell({
  notifications,
  unread,
}: {
  notifications: AppNotification[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-slate-600 transition-colors hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-lift sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Notifications</p>
              <p className="text-[11px] text-muted">{unread} unread</p>
            </div>
            <button
              type="button"
              disabled={isPending || unread === 0}
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                  router.refresh();
                })
              }
              className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          <div className="scroll-thin max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <Inbox className="mb-2 h-6 w-6 text-slate-300" />
                <p className="text-xs text-muted">You&apos;re all caught up.</p>
              </div>
            ) : (
              notifications.slice(0, 8).map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.link ?? "/notifications"}
                  onClick={() => {
                    setOpen(false);
                    if (!notification.is_read) {
                      void markNotificationReadAction(notification.id);
                    }
                  }}
                  className={`flex gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-slate-50 ${
                    notification.is_read ? "opacity-70" : "bg-blue-50/30"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      notification.is_read ? "bg-slate-200" : TYPE_DOT[notification.type] ?? "bg-slate-400"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-ink">{notification.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-muted">
                      {notification.body}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {timeAgo(notification.created_at)}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line bg-slate-50 px-4 py-2.5 text-center text-xs font-semibold text-blue-600 hover:bg-slate-100"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
