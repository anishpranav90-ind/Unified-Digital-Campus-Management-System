import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import { listNotifications, getUnreadNotificationCount } from "@/lib/data/notifications";
import { getUnreadMessageTotal } from "@/lib/data/mentorloop";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [notifications, unreadNotifications, unreadMessages] = await Promise.all([
    listNotifications(profile, 12),
    getUnreadNotificationCount(profile),
    getUnreadMessageTotal(profile),
  ]);

  return (
    <AppShell
      profile={profile}
      notifications={notifications}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
      demo={isDemoMode()}
    >
      {children}
    </AppShell>
  );
}
