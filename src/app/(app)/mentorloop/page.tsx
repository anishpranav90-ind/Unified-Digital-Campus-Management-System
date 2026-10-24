import Link from "next/link";
import { ArrowRight, LockKeyhole, MessagesSquare, UserRound, Users } from "lucide-react";
import { requireProfile } from "@/lib/session";
import {
  listFacultyCandidates,
  listMentorGroups,
  listStudentCandidates,
} from "@/lib/data/mentorloop";
import { timeAgo } from "@/lib/utils";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { isDemoMode } from "@/lib/env";
import { GroupForm } from "./group-form";

export const metadata = { title: "MentorLoop" };

export default async function MentorLoopPage() {
  const profile = await requireProfile();
  const groups = await listMentorGroups(profile);
  const canCreate = profile.role === "faculty" || profile.role === "admin";
  const [students, facultyDirectory] = canCreate
    ? await Promise.all([listStudentCandidates(), listFacultyCandidates()])
    : [[], []];

  const unread = groups.reduce((total, group) => total + (group.unread_count ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="MentorLoop · Mentor communication"
        title="Mentor groups"
        description="Focused academic conversations between students and faculty mentors."
        actions={<RealtimeRefresh demo={isDemoMode()} table="group_messages" channelKey="mentor-groups" label="Chat live" />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Your groups" value={groups.length} icon={<MessagesSquare className="h-5 w-5" />} tone="teal" />
        <StatCard label="Unread messages" value={unread} icon={<MessagesSquare className="h-5 w-5" />} tone="orange" />
        <StatCard
          label="Members across groups"
          value={groups.reduce((total, group) => total + (group.member_count ?? 0), 0)}
          icon={<Users className="h-5 w-5" />}
          tone="blue"
        />
      </div>

      <div className={`mt-5 grid gap-4 ${canCreate ? "lg:grid-cols-3" : ""}`}>
        <div className={canCreate ? "space-y-4 lg:col-span-2" : "space-y-4"}>
          <Card>
            <CardHeader
              title="Your groups"
              description={`${groups.length} authorized group${groups.length === 1 ? "" : "s"}`}
              icon={<MessagesSquare className="h-4 w-4" />}
            />
            {groups.length === 0 ? (
              <EmptyState
                icon={<MessagesSquare className="h-5 w-5" />}
                title="No mentor groups yet"
                description="You will appear here once a mentor adds you to a group."
              />
            ) : (
              <ul className="divide-y divide-line">
                {groups.map((group) => (
                  <li key={group.id}>
                    <Link
                      href={`/mentorloop/${group.id}`}
                      className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
                    >
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                        <MessagesSquare className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{group.name}</span>
                          {group.unread_count ? <Badge tone="orange">{group.unread_count} new</Badge> : null}
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-xs text-muted">{group.description}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3 w-3" /> {group.mentor?.full_name ?? "Mentor"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" /> {group.member_count} members
                          </span>
                          {group.last_message_at ? <span>{timeAgo(group.last_message_at)}</span> : null}
                        </span>
                        {group.last_message ? (
                          <span className="mt-1 line-clamp-1 block rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-600">
                            {group.last_message}
                          </span>
                        ) : null}
                      </span>
                      <ArrowRight className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-2">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-ink">Authorized conversations only</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Group membership is enforced with Row Level Security. Students cannot discover or read
                  messages from groups they do not belong to, and only mentors can manage membership.
                  Attachments are limited to 5 MB and approved file types.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {canCreate ? (
          <Card className="h-fit">
            <CardHeader title="Create a mentor group" description="Add students after creating" icon={<Users className="h-4 w-4" />} />
            <GroupForm
              students={students}
              faculty={facultyDirectory}
              profile={profile}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
