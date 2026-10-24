import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole, MessagesSquare, Plus, UserMinus, UserRound, Users } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { isDemoMode } from "@/lib/env";
import {
  getAttachmentUrl,
  getMentorGroup,
  listStudentCandidates,
  markGroupRead,
} from "@/lib/data/mentorloop";
import { addGroupMemberAction, removeGroupMemberAction } from "@/lib/actions/mentorloop";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Avatar } from "@/components/ui";
import { ChatPanel } from "./chat-panel";

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader
            title="Group discussion"
            description={`Mentor: ${detail.group.mentor?.full_name ?? "—"}`}
            icon={<MessagesSquare className="h-4 w-4" />}
            action={
              <span className="text-[10px] text-muted">
                {detail.messages.length} message{detail.messages.length === 1 ? "" : "s"}
              </span>
            }
          />
          <ChatPanel
            groupId={id}
            messages={detail.messages}
            profile={profile}
            attachmentUrls={attachmentUrls}
            demo={isDemoMode()}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Membership" description="Authorized members only" icon={<Users className="h-4 w-4" />} />
            <ul className="divide-y divide-line">
              {detail.members.map((member) => (
                <li key={member.user_id} className="flex items-center gap-2.5 px-4 py-3">
                  <Avatar name={member.profile?.full_name ?? "Member"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {member.profile?.full_name ?? "Member"}
                      {member.user_id === profile.id ? " (you)" : ""}
                    </p>
                    <p className="text-[10px] capitalize text-muted">
                      {member.member_role === "mentor" ? "Mentor" : "Student"}
                    </p>
                  </div>
                  {detail.isMentor && member.member_role !== "mentor" ? (
                    <form action={removeGroupMemberAction}>
                      <input type="hidden" name="group_id" value={id} />
                      <input type="hidden" name="user_id" value={member.user_id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-line p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${member.profile?.full_name ?? "member"}`}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>

            {detail.isMentor ? (
              <form action={addGroupMemberAction} className="flex items-center gap-2 border-t border-line p-3">
                <input type="hidden" name="group_id" value={id} />
                <select
                  name="user_id"
                  required
                  defaultValue=""
                  className="focus-ring h-8 min-w-0 flex-1 rounded-lg border border-line px-2 text-[11px]"
                >
                  <option value="" disabled>
                    Add a student…
                  </option>
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-navy-800"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </form>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-2">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-ink">Private by default</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Message access is restricted by RLS to group members. Only the mentor can change
                  membership, and messages can only be edited or deleted by their author.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
              <UserRound className="h-3.5 w-3.5" />
              Mentor: {detail.group.mentor?.full_name ?? "—"}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
