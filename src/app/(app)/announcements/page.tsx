import { Megaphone } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { listAnnouncements } from "@/lib/data/announcements";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { AnnouncementsList } from "@/components/dashboard/announcements-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { isDemoMode } from "@/lib/env";
import { AnnouncementForm } from "./announcement-form";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const profile = await requireProfile();
  const announcements = await listAnnouncements(profile, 30);
  const canPublish = profile.role === "faculty" || profile.role === "admin";

  return (
    <div>
      <PageHeader
        eyebrow="Campus communication"
        title="Announcements"
        description="Official notices from administrators and academic announcements from faculty."
        actions={<RealtimeRefresh demo={isDemoMode()} table="announcements" channelKey="announcements" />}
      />

      <div className={`grid gap-4 ${canPublish ? "lg:grid-cols-3" : ""}`}>
        <div className={canPublish ? "lg:col-span-2" : ""}>
          <Card>
            <CardHeader
              title="Campus noticeboard"
              description={`${announcements.filter((item) => !item.is_read).length} unread · ${announcements.length} announcements`}
              icon={<Megaphone className="h-4 w-4" />}
              action={<Badge tone="blue">Role-filtered audience</Badge>}
            />
            <AnnouncementsList announcements={announcements} />
          </Card>
        </div>

        {canPublish ? (
          <Card className="h-fit">
            <CardHeader
              title="Publish an announcement"
              description="Sent to the selected audience"
              icon={<Megaphone className="h-4 w-4" />}
            />
            <AnnouncementForm />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
