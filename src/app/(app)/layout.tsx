import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import { listNotifications, getUnreadNotificationCount } from "@/lib/data/notifications";
import { getUnreadMessageTotal } from "@/lib/data/mentorloop";
import { AppShell } from "@/components/layout/app-shell";
import { getLanguageCode } from "@/lib/i18n";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [profile, cookieStore] = await Promise.all([getCurrentProfile(), cookies()]);
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
      initialLanguage={getLanguageCode(cookieStore.get("unisync-language")?.value)}
    >
      {children}
    </AppShell>
  );
}
