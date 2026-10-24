import "server-only";
import type {
  GroupMessage,
  MentorGroup,
  MentorGroupMember,
  Profile,
} from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyUsers, writeAuditLog } from "@/lib/data/helpers";

const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export function validateAttachment(file: File | null) {
  if (!file || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) return "Attachments must be 5 MB or smaller.";
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    return "Allowed attachments: PDF, images, text, Word, PowerPoint or ZIP.";
  }
  return null;
}

function demoUnread(profile: Profile, groupId: string) {
  const store = getDemoStore();
  const membership = store.mentor_group_members.find(
    (member) => member.group_id === groupId && member.user_id === profile.id,
  );
  if (!membership) return 0;
  const since = membership.last_read_at;
  return store.group_messages.filter(
    (message) =>
      message.group_id === groupId &&
      message.sender_id !== profile.id &&
      (!since || message.created_at > since),
  ).length;
}

export async function listMentorGroups(profile: Profile): Promise<MentorGroup[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const memberships = store.mentor_group_members.filter((member) => member.user_id === profile.id);
    const groups: MentorGroup[] = [];
    for (const membership of memberships) {
      const group = store.mentor_groups.find((item) => item.id === membership.group_id);
      if (!group) continue;
      const messages = store.group_messages
        .filter((message) => message.group_id === group.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const mentorProfile = store.profiles.find((person) => person.id === group.mentor_id);
      groups.push({
        ...group,
        mentor: mentorProfile
          ? { id: mentorProfile.id, full_name: mentorProfile.full_name, email: mentorProfile.email }
          : null,
        member_count: store.mentor_group_members.filter((member) => member.group_id === group.id).length,
        unread_count: demoUnread(profile, group.id),
        last_message: messages.at(-1)?.body ?? null,
        last_message_at: messages.at(-1)?.created_at ?? null,
      });
    }
    return groups.sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
  }

  const supabase = await createSupabaseServerClient();
  const { data: memberships } = await supabase
    .from("mentor_group_members")
    .select("group_id, last_read_at")
    .eq("user_id", profile.id);
  if (!memberships?.length) return [];

  const groupIds = memberships.map((row) => row.group_id as string);
  const [{ data: groups }, { data: members }, { data: messages }] = await Promise.all([
    supabase
      .from("mentor_groups")
      .select("*, mentor:profiles!mentor_groups_mentor_id_fkey(id, full_name, email)")
      .in("id", groupIds),
    supabase.from("mentor_group_members").select("group_id, user_id").in("group_id", groupIds),
    supabase
      .from("group_messages")
      .select("id, group_id, body, created_at, sender_id")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const lastRead = new Map(memberships.map((row) => [row.group_id as string, row.last_read_at as string | null]));
  return ((groups ?? []) as MentorGroup[])
    .map((group) => {
      const groupMessages = (messages ?? []).filter((message) => message.group_id === group.id);
      const latest = groupMessages[0];
      const since = lastRead.get(group.id);
      const unread = groupMessages.filter(
        (message) =>
          message.sender_id !== profile.id && (!since || (message.created_at as string) > since),
      ).length;
      return {
        ...group,
        member_count: (members ?? []).filter((member) => member.group_id === group.id).length,
        unread_count: unread,
        last_message: (latest?.body as string) ?? null,
        last_message_at: (latest?.created_at as string) ?? null,
      };
    })
    .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
}

export async function isGroupMember(profile: Profile, groupId: string) {
  if (isDemoMode()) {
    return getDemoStore().mentor_group_members.some(
      (member) => member.group_id === groupId && member.user_id === profile.id,
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("mentor_group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", profile.id)
    .maybeSingle();
  return Boolean(data);
}

export async function getMentorGroup(profile: Profile, groupId: string) {
  if (!(await isGroupMember(profile, groupId))) return null;

  if (isDemoMode()) {
    const store = getDemoStore();
    const group = store.mentor_groups.find((item) => item.id === groupId);
    if (!group) return null;
    const members: MentorGroupMember[] = store.mentor_group_members
      .filter((member) => member.group_id === groupId)
      .map((member) => ({
        ...member,
        profile: store.profiles.find((person) => person.id === member.user_id) ?? null,
      }));
    const messages: GroupMessage[] = store.group_messages
      .filter((message) => message.group_id === groupId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((message) => ({
        ...message,
        sender: store.profiles.find((person) => person.id === message.sender_id) ?? null,
        attachments: store.message_attachments.filter((attachment) => attachment.message_id === message.id),
      }));
    return {
      group: {
        ...group,
        mentor: store.profiles.find((person) => person.id === group.mentor_id) ?? null,
        member_count: members.length,
        unread_count: demoUnread(profile, groupId),
      },
      members,
      messages,
      isMentor: group.mentor_id === profile.id || profile.role === "admin",
    };
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: group }, { data: members }, { data: messages }] = await Promise.all([
    supabase
      .from("mentor_groups")
      .select("*, mentor:profiles!mentor_groups_mentor_id_fkey(id, full_name, email)")
      .eq("id", groupId)
      .maybeSingle(),
    supabase
      .from("mentor_group_members")
      .select("*, profile:profiles(id, full_name, email, role)")
      .eq("group_id", groupId),
    supabase
      .from("group_messages")
      .select(
        "*, sender:profiles!group_messages_sender_id_fkey(id, full_name, role), attachments:message_attachments(*)",
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  if (!group) return null;

  const memberRows = (members ?? []) as MentorGroupMember[];
  const messageRows = (messages ?? []) as GroupMessage[];
  const me = memberRows.find((member) => member.user_id === profile.id);
  const unreadCount = messageRows.filter(
    (message) =>
      message.sender_id !== profile.id &&
      (!me?.last_read_at || new Date(message.created_at) > new Date(me.last_read_at)),
  ).length;

  return {
    group: {
      ...(group as MentorGroup),
      member_count: memberRows.length,
      unread_count: unreadCount,
    },
    members: memberRows,
    messages: messageRows,
    isMentor: (group as MentorGroup).mentor_id === profile.id || profile.role === "admin",
  };
}

export async function markGroupRead(profile: Profile, groupId: string) {
  const readAt = new Date().toISOString();
  if (isDemoMode()) {
    const membership = getDemoStore().mentor_group_members.find(
      (member) => member.group_id === groupId && member.user_id === profile.id,
    );
    if (membership) membership.last_read_at = readAt;
    return;
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("mentor_group_members")
    .update({ last_read_at: readAt })
    .eq("group_id", groupId)
    .eq("user_id", profile.id);
}

export async function sendGroupMessage(profile: Profile, groupId: string, body: string, file: File | null) {
  if (!(await isGroupMember(profile, groupId))) {
    return { ok: false as const, error: "You are not a member of this group." };
  }
  const attachmentError = validateAttachment(file);
  if (attachmentError) return { ok: false as const, error: attachmentError };

  const mentionIds = await groupMemberIds(groupId);

  if (isDemoMode()) {
    const store = getDemoStore();
    const message: GroupMessage = {
      id: crypto.randomUUID(),
      group_id: groupId,
      sender_id: profile.id,
      body,
      created_at: new Date().toISOString(),
      sender: { id: profile.id, full_name: profile.full_name, role: profile.role },
      attachments: [],
    };
    store.group_messages.push(message);
    if (file && file.size > 0) {
      store.message_attachments.push({
        id: crypto.randomUUID(),
        message_id: message.id,
        file_name: file.name,
        file_path: `demo://${file.name}`,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        created_at: new Date().toISOString(),
      });
    }
    await markGroupRead(profile, groupId);
    await notifyUsers(mentionIds.filter((id) => id !== profile.id), {
      title: `New message in ${store.mentor_groups.find((group) => group.id === groupId)?.name ?? "MentorLoop"}`,
      body: `${profile.full_name}: ${body.slice(0, 120)}`,
      type: "message",
      link: `/mentorloop/${groupId}`,
    });
    return { ok: true as const, simulated: true };
  }

  const supabase = await createSupabaseServerClient();
  const { data: message, error } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, sender_id: profile.id, body })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  if (file && file.size > 0) {
    const path = `group/${groupId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from("message-attachments")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return { ok: false as const, error: `Attachment upload failed: ${uploadError.message}` };
    await supabase.from("message_attachments").insert({
      message_id: message.id,
      file_name: file.name,
      file_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    });
  }

  await markGroupRead(profile, groupId);
  const { data: group } = await supabase.from("mentor_groups").select("name").eq("id", groupId).maybeSingle();
  await notifyUsers(mentionIds.filter((id) => id !== profile.id), {
    title: `New message in ${group?.name ?? "MentorLoop"}`,
    body: `${profile.full_name}: ${body.slice(0, 120)}`,
    type: "message",
    link: `/mentorloop/${groupId}`,
  });
  return { ok: true as const, simulated: false };
}

async function groupMemberIds(groupId: string) {
  if (isDemoMode()) {
    return getDemoStore().mentor_group_members
      .filter((member) => member.group_id === groupId)
      .map((member) => member.user_id);
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("mentor_group_members").select("user_id").eq("group_id", groupId);
  return (data ?? []).map((row) => row.user_id as string);
}

export async function createMentorGroup(
  profile: Profile,
  input: { name: string; description: string; department_id: string | null; mentor_id: string },
  studentIds: string[],
) {
  if (profile.role !== "faculty" && profile.role !== "admin") {
    return { ok: false as const, error: "Only mentors and administrators can create groups." };
  }
  const mentorId = profile.role === "admin" ? input.mentor_id : profile.id;
  const uniqueStudents = Array.from(new Set(studentIds));

  if (isDemoMode()) {
    const store = getDemoStore();
    const group: MentorGroup = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      mentor_id: mentorId,
      department_id: input.department_id,
      mentor: store.profiles.find((person) => person.id === mentorId) ?? null,
      created_at: new Date().toISOString(),
    };
    store.mentor_groups.push(group);
    store.mentor_group_members.push({
      group_id: group.id,
      user_id: mentorId,
      member_role: "mentor",
      joined_at: new Date().toISOString(),
      last_read_at: new Date().toISOString(),
    });
    uniqueStudents.forEach((userId) => {
      if (
        !store.mentor_group_members.some(
          (member) => member.group_id === group.id && member.user_id === userId,
        )
      ) {
        store.mentor_group_members.push({
          group_id: group.id,
          user_id: userId,
          member_role: "student",
          joined_at: new Date().toISOString(),
          last_read_at: null,
        });
      }
    });
    await notifyUsers(uniqueStudents, {
      title: `Added to ${group.name}`,
      body: `${profile.full_name} added you to a MentorLoop group.`,
      type: "message",
      link: `/mentorloop/${group.id}`,
    });
    await writeAuditLog(profile, "mentor_group.created", "mentor_groups", group.id, { name: group.name });
    return { ok: true as const, id: group.id };
  }

  const supabase = await createSupabaseServerClient();
  const { data: group, error } = await supabase
    .from("mentor_groups")
    .insert({
      name: input.name,
      description: input.description,
      department_id: input.department_id,
      mentor_id: mentorId,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  const rows = [
    { group_id: group.id, user_id: mentorId, member_role: "mentor", last_read_at: new Date().toISOString() },
    ...uniqueStudents.map((userId) => ({ group_id: group.id, user_id: userId, member_role: "student" })),
  ];
  const { error: memberError } = await supabase.from("mentor_group_members").insert(rows);
  if (memberError) return { ok: false as const, error: memberError.message };

  await notifyUsers(uniqueStudents, {
    title: `Added to ${input.name}`,
    body: `${profile.full_name} added you to a MentorLoop group.`,
    type: "message",
    link: `/mentorloop/${group.id}`,
  });
  await writeAuditLog(profile, "mentor_group.created", "mentor_groups", group.id, { name: input.name });
  return { ok: true as const, id: group.id as string };
}

export async function addGroupMember(profile: Profile, groupId: string, userId: string) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const group = store.mentor_groups.find((item) => item.id === groupId);
    if (!group) return { ok: false as const, error: "Group not found." };
    if (group.mentor_id !== profile.id && profile.role !== "admin") {
      return { ok: false as const, error: "Only the group mentor can manage membership." };
    }
    if (store.mentor_group_members.some((m) => m.group_id === groupId && m.user_id === userId)) {
      return { ok: false as const, error: "That student is already a member." };
    }
    store.mentor_group_members.push({
      group_id: groupId,
      user_id: userId,
      member_role: "student",
      joined_at: new Date().toISOString(),
      last_read_at: null,
    });
    await notifyUsers([userId], {
      title: `Added to ${group.name}`,
      body: `${profile.full_name} added you to the group.`,
      type: "message",
      link: `/mentorloop/${groupId}`,
    });
    return { ok: true as const };
  }
  const supabase = await createSupabaseServerClient();
  const { data: group } = await supabase.from("mentor_groups").select("mentor_id, name").eq("id", groupId).maybeSingle();
  if (!group || (group.mentor_id !== profile.id && profile.role !== "admin")) {
    return { ok: false as const, error: "Only the group mentor can manage membership." };
  }
  const { error } = await supabase
    .from("mentor_group_members")
    .insert({ group_id: groupId, user_id: userId, member_role: "student" });
  if (error) return { ok: false as const, error: error.message };
  await notifyUsers([userId], {
    title: `Added to ${group.name}`,
    body: `${profile.full_name} added you to the group.`,
    type: "message",
    link: `/mentorloop/${groupId}`,
  });
  return { ok: true as const };
}

export async function removeGroupMember(profile: Profile, groupId: string, userId: string) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const group = store.mentor_groups.find((item) => item.id === groupId);
    if (!group) return { ok: false as const, error: "Group not found." };
    if (group.mentor_id !== profile.id && profile.role !== "admin") {
      return { ok: false as const, error: "Only the group mentor can manage membership." };
    }
    if (userId === group.mentor_id) return { ok: false as const, error: "The mentor cannot be removed." };
    store.mentor_group_members = store.mentor_group_members.filter(
      (member) => !(member.group_id === groupId && member.user_id === userId),
    );
    return { ok: true as const };
  }
  const supabase = await createSupabaseServerClient();
  const { data: group } = await supabase.from("mentor_groups").select("mentor_id").eq("id", groupId).maybeSingle();
  if (!group || (group.mentor_id !== profile.id && profile.role !== "admin")) {
    return { ok: false as const, error: "Only the group mentor can manage membership." };
  }
  if (userId === group.mentor_id) return { ok: false as const, error: "The mentor cannot be removed." };
  const { error } = await supabase
    .from("mentor_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function getAttachmentUrl(path: string) {
  if (isDemoMode()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.storage.from("message-attachments").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function listStudentCandidates() {
  if (isDemoMode()) {
    return getDemoStore()
      .profiles.filter((profile) => profile.role === "student")
      .map((profile) => ({ id: profile.id, full_name: profile.full_name, email: profile.email }));
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "student")
    .order("full_name");
  return (data ?? []) as { id: string; full_name: string; email: string }[];
}

export async function listFacultyCandidates() {
  if (isDemoMode()) {
    return getDemoStore().profiles.filter(
      (profile) => profile.role === "faculty" || profile.role === "admin",
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["faculty", "admin"])
    .order("full_name");
  return (data ?? []) as Profile[];
}

export async function getUnreadMessageTotal(profile: Profile) {
  const groups = await listMentorGroups(profile);
  return groups.reduce((total, group) => total + (group.unread_count ?? 0), 0);
}
