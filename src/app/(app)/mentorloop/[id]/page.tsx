import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import {
  getAttachmentUrl,
  getMentorGroup,
  listMentorGroupActivities,
  listStudentCandidates,
  markGroupRead,
} from "@/lib/data/mentorloop";
import { Badge, PageHeader } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { GroupWorkspace } from "./group-workspace";

export const metadata = { title: "Group chat" };

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const query = await searchParams;
  const detail = await getMentorGroup(profile, id);
  if (!detail) notFound();

  if (detail.group.unread_count) {
    await markGroupRead(profile, id);
  }

  const attachmentUrls: Record<string, string | null> = {};
  if (!isDemoMode()) {
    const attachments = detail.messages.flatMap((message) => message.attachments ?? []);
    await Promise.all(
      attachments.map(async (attachment) => {
        attachmentUrls[attachment.id] = await getAttachmentUrl(attachment.file_path);
      }),
    );
  }

  const candidates = detail.isMentor ? await listStudentCandidates() : [];
  const memberIds = new Set(detail.members.map((member) => member.user_id));
  const availableStudents = candidates.filter((student) => !memberIds.has(student.id));
  const activities = await listMentorGroupActivities(profile, id);

  return (
    <div>
      <Link
        href="/mentorloop"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to groups
      </Link>

      <PageHeader
        eyebrow="MentorLoop"
        title={detail.group.name}
        description={detail.group.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RealtimeRefresh
              demo={isDemoMode()}
              table="group_messages"
              channelKey={`group-${id}`}
              label="Live chat"
            />
            <Badge tone="teal">
              <Users className="h-3 w-3" /> {detail.members.length} members
            </Badge>
          </div>
        }
      />

      {query.error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {query.error}
        </p>
      ) : null}

      <GroupWorkspace
        groupId={id}
        groupName={detail.group.name}
        mentorName={detail.group.mentor?.full_name ?? "Not set"}
        members={detail.members}
        messages={detail.messages}
        profile={profile}
        attachmentUrls={attachmentUrls}
        activities={activities}
        isMentor={detail.isMentor}
        demo={isDemoMode()}
        availableStudents={availableStudents.map((student) => ({
          id: student.id,
          full_name: student.full_name,
        }))}
      />
    </div>
  );
}
