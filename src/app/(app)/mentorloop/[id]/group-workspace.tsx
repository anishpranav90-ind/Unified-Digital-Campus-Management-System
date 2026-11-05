"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  BookOpenText,
  Check,
  Clock3,
  ExternalLink,
  FileSpreadsheet,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Send,
  UserMinus,
  X,
  XCircle,
} from "lucide-react";
import { Alert, Avatar, Badge, Button, Card, CardHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import {
  addGroupMemberAction,
  importGroupActivityAction,
  removeGroupMemberAction,
  reviewGroupActivityAction,
  submitGroupActivityAction,
} from "@/lib/actions/mentorloop";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { formatDateTime } from "@/lib/utils";
import type {
  GroupMessage,
  MentorActivityCategory,
  MentorActivityRecord,
  MentorGroupMember,
  Profile,
} from "@/types";
import { ChatPanel } from "./chat-panel";

const CATEGORY_LABELS: Record<MentorActivityCategory, string> = {
  tech: "Tech",
  research: "Research",
  culturals: "Culturals",
  sports: "Sports",
};

const ACTIVITY_LABELS: Record<MentorActivityRecord["activity_type"], string> = {
  google_form_submission: "Google Form",
  hackathon_registration: "Hackathon registration",
  paper_publication: "Paper publication",
  other: "Other activity",
};

const CSV_TEMPLATE = [
  "student_email,category,activity_type,title,source,source_record_id,occurred_at,proof_url",
  "student@college.edu.in,tech,hackathon_registration,Campus Hack 2026,Google Sheet,registration-001,2026-10-15T10:00:00Z,https://example.edu/proof/registration-001",
].join("\n");

export function GroupWorkspace({
  groupId,
  groupName,
  mentorName,
  members,
  messages,
  profile,
  attachmentUrls,
  activities,
  isMentor,
  demo,
  availableStudents,
}: {
  groupId: string;
  groupName: string;
  mentorName: string;
  members: MentorGroupMember[];
  messages: GroupMessage[];
  profile: Profile;
  attachmentUrls: Record<string, string | null>;
  activities: MentorActivityRecord[];
  isMentor: boolean;
  demo: boolean;
  availableStudents: Pick<Profile, "id" | "full_name">[];
}) {
  const [tab, setTab] = useState<"chat" | "activity">("chat");
  const [selectedStudent, setSelectedStudent] = useState<MentorGroupMember | null>(null);
  const [activityOverrides, setActivityOverrides] = useState<Record<string, MentorActivityRecord | null>>({});
  const [activityConnected, setActivityConnected] = useState(false);
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const liveActivities = useMemo(() => {
    const records = new Map(activities.map((activity) => [activity.id, activity]));
    Object.entries(activityOverrides).forEach(([id, activity]) => {
      if (activity) records.set(id, activity);
      else records.delete(id);
    });
    return Array.from(records.values()).sort(
      (left, right) => right.occurred_at.localeCompare(left.occurred_at),
    );
  }, [activities, activityOverrides]);
  useEffect(() => {
    if (demo || tab !== "activity") return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`${isMentor ? "mentor_channel" : "student_channel"}_${profile.id}_${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mentor_group_activity_records",
          filter: `group_id=eq.${groupId}`,
        },
        (payload: {
          eventType: "INSERT" | "UPDATE" | "DELETE";
          new: Partial<MentorActivityRecord>;
          old: Partial<MentorActivityRecord>;
        }) => {
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id?: string }).id;
            if (removedId) setActivityOverrides((current) => ({ ...current, [removedId]: null }));
            return;
          }
          const nextRecord = payload.new as MentorActivityRecord;
          if (!nextRecord?.id) return;
          setActivityOverrides((current) => ({ ...current, [nextRecord.id]: nextRecord }));
        },
      );
    channel.subscribe((status: string) => {
      setActivityConnected(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") router.refresh();
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demo, groupId, isMentor, profile.id, router, tab]);
  const activityByStudent = useMemo(() => {
    const records = new Map<string, MentorActivityRecord[]>();
    for (const activity of liveActivities) {
      const current = records.get(activity.student_id) ?? [];
      current.push(activity);
      records.set(activity.student_id, current);
    }
    return records;
  }, [liveActivities]);

  const selectedRecords = selectedStudent
    ? activityByStudent.get(selectedStudent.user_id) ?? []
    : [];
  const selectedCounts = countCategories(
    selectedRecords.filter((record) => record.verification_status === "verified"),
  );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader
            title={tab === "chat" ? "Group discussion" : "Activity tracker"}
            description={
              tab === "chat"
                ? `Mentor: ${mentorName}`
                : isMentor
                  ? "Group proof submissions and verified activity"
                  : "Your activity proofs and mentor reviews"
            }
            icon={tab === "chat" ? <MessagesSquare className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
            action={
              <div role="tablist" aria-label="Group view" className="flex rounded-lg border border-line p-0.5">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "chat"}
                  onClick={() => setTab("chat")}
                  className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${tab === "chat" ? "bg-navy-900 text-white" : "text-muted hover:bg-slate-50"}`}
                >
                  Chat
                </button>
                {isMentor || profile.role === "student" ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "activity"}
                    onClick={() => setTab("activity")}
                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${tab === "activity" ? "bg-navy-900 text-white" : "text-muted hover:bg-slate-50"}`}
                  >
                    {isMentor ? "Activity Tracker" : "My Activities"}
                  </button>
                ) : null}
              </div>
            }
          />
          {tab === "chat" ? (
            <ChatPanel
              groupId={groupId}
              messages={messages}
              profile={profile}
              attachmentUrls={attachmentUrls}
              demo={demo}
            />
          ) : (
            <ActivityTracker
              groupId={groupId}
              records={liveActivities}
              members={members}
              isMentor={isMentor}
              demo={demo}
              liveConnected={activityConnected}
              onUpdated={refresh}
            />
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Membership" description="Authorized members only" icon={<MessagesSquare className="h-4 w-4" />} />
            <ul className="divide-y divide-line">
              {members.map((member) => {
                const memberRecords = activityByStudent.get(member.user_id) ?? [];
                const verifiedRecords = memberRecords.filter((record) => record.verification_status === "verified");
                const counts = countCategories(verifiedRecords);
                const isStudent = member.member_role === "student" && member.profile?.role === "student";
                return (
                  <li key={member.user_id} className="flex items-start gap-2.5 px-4 py-3">
                    <Avatar name={member.profile?.full_name ?? "Member"} size="sm" />
                    <div className="min-w-0 flex-1">
                      {isMentor && isStudent ? (
                        <button
                          type="button"
                          className="truncate text-left text-xs font-medium text-ink hover:text-teal-700"
                          onClick={() => setSelectedStudent(member)}
                        >
                          {member.profile?.full_name ?? "Member"}
                          {member.user_id === profile.id ? " (you)" : ""}
                        </button>
                      ) : (
                        <p className="truncate text-xs font-medium text-ink">
                          {member.profile?.full_name ?? "Member"}
                          {member.user_id === profile.id ? " (you)" : ""}
                        </p>
                      )}
                      <p className="text-[10px] capitalize text-muted">
                        {member.member_role === "mentor" ? "Mentor" : member.member_role}
                      </p>
                      {isMentor && isStudent ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {Object.entries(counts).map(([category, count]) => (
                            <span
                              key={category}
                              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600"
                              title={`${count} verified ${category} activities`}
                            >
                              {CATEGORY_LABELS[category as MentorActivityCategory]} {count}
                            </span>
                          ))}
                          {verifiedRecords.length === 0 ? (
                            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">
                              No verified proofs yet
                            </span>
                          ) : null}
                          {memberRecords.some((record) => record.verification_status === "pending") ? (
                            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
                              Proof pending
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {isMentor && isStudent ? (
                      <div className="flex shrink-0 items-center gap-1">
                        {member.profile?.email ? (
                          <a
                            href={`mailto:${encodeURIComponent(member.profile.email)}?subject=${encodeURIComponent(`Mentor guidance · ${groupName}`)}&body=${encodeURIComponent(`Hi ${member.profile.full_name},\n\nI wanted to check in and offer guidance. Let me know what support would be useful.\n\n${mentorName}`)}`}
                            className="rounded-lg border border-line p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
                            aria-label={`Send guidance to ${member.profile.full_name}`}
                            title="Send private email guidance"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <form action={removeGroupMemberAction}>
                          <input type="hidden" name="group_id" value={groupId} />
                          <input type="hidden" name="user_id" value={member.user_id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-line p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${member.profile?.full_name ?? "member"}`}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {isMentor ? (
              <form action={addGroupMemberAction} className="flex items-center gap-2 border-t border-line p-3">
                <input type="hidden" name="group_id" value={groupId} />
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
                <Button type="submit" size="sm">
                  Add
                </Button>
              </form>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-ink">Verified activity only</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Activity records are visible to the group mentor and the student concerned. Imports are
                  attributed to the staff member who submitted them.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {selectedStudent?.profile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedStudent(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-activity-title"
            className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"
          >
            <header className="flex items-start gap-3 border-b border-line p-5">
              <Avatar name={selectedStudent.profile.full_name} size="md" />
              <div className="min-w-0 flex-1">
                <h2 id="student-activity-title" className="text-base font-bold text-ink">
                  {selectedStudent.profile.full_name}
                </h2>
                <p className="text-xs text-muted">360° Activity Profile · {groupName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink"
                aria-label="Close activity profile"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="scroll-thin max-h-[calc(85vh-88px)] space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(selectedCounts).map(([category, count]) => (
                  <div key={category} className="rounded-xl border border-line bg-slate-50 p-3 text-center">
                    <p className="text-lg font-bold text-ink">{count}</p>
                    <p className="text-[10px] text-muted">{CATEGORY_LABELS[category as MentorActivityCategory]}</p>
                  </div>
                ))}
              </div>
              {selectedRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-6 text-center">
                  <BookOpenText className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold text-ink">No activity records yet</p>
                  <p className="mt-1 text-xs text-muted">A lack of records does not necessarily mean a lack of activity.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {selectedRecords.map((record) => (
                    <ActivityRecordItem key={record.id} record={record} />
                  ))}
                </ul>
              )}
              {selectedStudent.profile.email ? (
                <a
                  href={`mailto:${encodeURIComponent(selectedStudent.profile.email)}?subject=${encodeURIComponent(`Mentor guidance · ${groupName}`)}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-navy-800"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Send private guidance
                </a>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ActivityTracker({
  groupId,
  records,
  members,
  isMentor,
  demo,
  liveConnected,
  onUpdated,
}: {
  groupId: string;
  records: MentorActivityRecord[];
  members: MentorGroupMember[];
  isMentor: boolean;
  demo: boolean;
  liveConnected: boolean;
  onUpdated: () => void;
}) {
  const [state, formAction] = useActionState(importGroupActivityAction, EMPTY_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onUpdated();
    }
  }, [state.success, onUpdated]);

  if (!isMentor) {
    return (
      <StudentActivityPanel
        groupId={groupId}
        records={records}
        demo={demo}
        onUpdated={onUpdated}
      />
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[10px]">
        <span className="font-medium text-slate-600">Group activity feed</span>
        <span className={`inline-flex items-center gap-1.5 ${liveConnected ? "text-emerald-700" : "text-slate-500"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${liveConnected ? "bg-emerald-500" : "bg-slate-400"}`} />
          {demo ? "Demo polling" : liveConnected ? "Live updates" : "Connecting…"}
        </span>
      </div>
      {demo ? (
        <Alert tone="info">
          Activity data is not simulated. Connect the Supabase database to submit and verify activity proofs.
        </Alert>
      ) : (
        <section className="rounded-xl border border-line bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-ink">Import external records</h3>
              <p className="mt-1 max-w-lg text-[10px] leading-relaxed text-muted">
                Upload a CSV export from an approved source. Imported records are attributed to you;
                duplicate source IDs are safely skipped.
              </p>
            </div>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}
              download="mentorloop-activity-template.csv"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 hover:underline"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> CSV template
            </a>
          </div>
          <form ref={formRef} action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="group_id" value={groupId} />
            <input
              type="file"
              name="records"
              accept=".csv,text/csv"
              required
              className="focus-ring min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-2 text-[10px] file:mr-2 file:rounded-md file:border-0 file:bg-teal-50 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-teal-800"
            />
            <SubmitButton pendingText="Importing…" size="sm">
              Import CSV
            </SubmitButton>
          </form>
          {state.error ? <Alert tone="error" className="mt-3">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success" className="mt-3">{state.success}</Alert> : null}
          <p className="mt-2 break-all text-[9px] text-muted">
            Required columns: student_email, category, activity_type, title, source, source_record_id, occurred_at, proof_url.
          </p>
        </section>
      )}

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <Activity className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-ink">No activity records</p>
          <p className="mt-1 text-xs text-muted">
            {demo ? "Switch to the connected database to import records." : "Import a source export to start the group's verified activity log."}
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink">Proof and registration log</h3>
            <Badge tone="teal">{records.length} records</Badge>
          </div>
          <ul className="space-y-2">
            {records.map((record) => (
              <ActivityRecordItem
                key={record.id}
                record={record}
                studentName={
                  members.find((member) => member.user_id === record.student_id)?.profile?.full_name ??
                  "Group student"
                }
                canReview={record.verification_status === "pending"}
                groupId={groupId}
                onReviewed={onUpdated}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StudentActivityPanel({
  groupId,
  records,
  demo,
  onUpdated,
}: {
  groupId: string;
  records: MentorActivityRecord[];
  demo: boolean;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState<MentorActivityRecord | null>(null);
  const [state, formAction] = useActionState(submitGroupActivityAction, EMPTY_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onUpdated();
    }
  }, [state.success, onUpdated]);

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[10px]">
        <span className="font-medium text-slate-600">Your private activity feed</span>
        <span className="text-muted">{records.length} records</span>
      </div>
      {demo ? (
        <Alert tone="info">Student proof submissions are available when connected to Supabase.</Alert>
      ) : (
        <section className="rounded-xl border border-line bg-slate-50 p-4">
          <h3 className="text-xs font-bold text-ink">{editing ? "Edit pending proof" : "Submit an activity proof"}</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            Your submission is private to you and your assigned mentor until reviewed. Use HTTPS links and
            check the destination before sharing proof.
          </p>
          <form
            key={editing?.id ?? "new"}
            ref={formRef}
            action={formAction}
            className="mt-3 grid gap-2 sm:grid-cols-2"
          >
            <input type="hidden" name="group_id" value={groupId} />
            {editing ? <input type="hidden" name="activity_id" value={editing.id} /> : null}
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={editing?.title ?? ""}
              placeholder="Activity / event title"
              className="focus-ring rounded-lg border border-line px-3 py-2 text-xs sm:col-span-2"
            />
            <select
              name="category"
              required
              defaultValue={editing?.category ?? "tech"}
              className="focus-ring rounded-lg border border-line bg-white px-3 py-2 text-xs"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              name="activity_type"
              required
              defaultValue={editing?.activity_type ?? "other"}
              className="focus-ring rounded-lg border border-line bg-white px-3 py-2 text-xs"
            >
              <option value="google_form_submission">Google Form submission</option>
              <option value="hackathon_registration">Hackathon registration</option>
              <option value="paper_publication">Paper publication</option>
              <option value="other">Other</option>
            </select>
            <input
              type="date"
              name="occurred_at"
              required
              defaultValue={editing?.occurred_at.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
              className="focus-ring rounded-lg border border-line bg-white px-3 py-2 text-xs"
            />
            <input
              type="url"
              name="proof_url"
              maxLength={2000}
              defaultValue={editing?.proof_url ?? ""}
              placeholder="https:// proof link (optional)"
              className="focus-ring rounded-lg border border-line px-3 py-2 text-xs"
            />
            <div className="flex items-center gap-2 sm:col-span-2">
              <SubmitButton pendingText="Saving…" size="sm">
                {editing ? "Update pending proof" : "Submit for review"}
              </SubmitButton>
              {editing ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
          {state.error ? <Alert tone="error" className="mt-3">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success" className="mt-3">{state.success}</Alert> : null}
        </section>
      )}

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <Activity className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-ink">No activity proofs yet</p>
          <p className="mt-1 text-xs text-muted">Submit an activity to share it privately with your mentor.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((record) => (
            <ActivityRecordItem
              key={record.id}
              record={record}
              canEdit={record.verification_status === "pending" && record.submitted_by !== null}
              onEdit={() => setEditing(record)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityRecordItem({
  record,
  studentName,
  canReview = false,
  canEdit = false,
  groupId,
  onReviewed,
  onEdit,
}: {
  record: MentorActivityRecord;
  studentName?: string;
  canReview?: boolean;
  canEdit?: boolean;
  groupId?: string;
  onReviewed?: () => void;
  onEdit?: () => void;
}) {
  const proofHost = getProofHost(record.proof_url);
  return (
    <li className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <BookOpenText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-xs font-semibold text-ink">{record.title}</p>
          {record.verification_status === "verified" ? (
            <Badge tone="green"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
          ) : record.verification_status === "rejected" ? (
            <Badge tone="red"><XCircle className="h-3 w-3" /> Rejected</Badge>
          ) : (
            <Badge tone="amber"><Clock3 className="h-3 w-3" /> Pending review</Badge>
          )}
        </div>
        {studentName ? <p className="mt-0.5 text-[10px] font-medium text-teal-700">{studentName}</p> : null}
        <p className="mt-1 text-[10px] text-muted">
          {ACTIVITY_LABELS[record.activity_type]} · {CATEGORY_LABELS[record.category]} · {record.source}
        </p>
        <p className="mt-1 text-[9px] text-slate-400">
          Occurred {formatDateTime(record.occurred_at)} · Imported {formatDateTime(record.imported_at)}
        </p>
      </div>
      {record.proof_url ? (
        <a
          href={record.proof_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-line p-2 text-slate-500 hover:bg-slate-50 hover:text-teal-700"
          aria-label={`Open external proof on ${proofHost} for ${record.title}`}
          title={`External site: ${proofHost}. Verify the address before proceeding.`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
      {canEdit && onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-lg border border-line p-2 text-slate-500 hover:bg-slate-50 hover:text-teal-700"
          aria-label={`Edit pending proof ${record.title}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {canReview && groupId && onReviewed ? (
        <ReviewActivityForm groupId={groupId} activityId={record.id} onReviewed={onReviewed} />
      ) : null}
    </li>
  );
}

function ReviewActivityForm({
  groupId,
  activityId,
  onReviewed,
}: {
  groupId: string;
  activityId: string;
  onReviewed: () => void;
}) {
  const [state, formAction] = useActionState(reviewGroupActivityAction, EMPTY_FORM_STATE);
  useEffect(() => {
    if (state.success) onReviewed();
  }, [state.success, onReviewed]);

  return (
    <form action={formAction} className="flex shrink-0 flex-col gap-1">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="activity_id" value={activityId} />
      <SubmitButton name="decision" value="verified" variant="success" size="sm" pendingText="Saving…">
        <Check className="h-3.5 w-3.5" /> Verify
      </SubmitButton>
      <SubmitButton name="decision" value="rejected" variant="danger" size="sm" pendingText="Saving…">
        <XCircle className="h-3.5 w-3.5" /> Reject
      </SubmitButton>
      {state.error ? <span className="max-w-24 text-[9px] text-red-600">{state.error}</span> : null}
    </form>
  );
}

function getProofHost(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return "unverified destination";
  }
}

function countCategories(records: MentorActivityRecord[]) {
  const counts: Record<MentorActivityCategory, number> = {
    tech: 0,
    research: 0,
    culturals: 0,
    sports: 0,
  };
  records.forEach((record) => {
    counts[record.category] += 1;
  });
  return counts;
}
