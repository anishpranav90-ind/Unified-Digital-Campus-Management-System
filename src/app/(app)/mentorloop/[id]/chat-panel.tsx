"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { AlertCircle, Paperclip, Send } from "lucide-react";
import { Alert, Avatar } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendMessageAction } from "@/lib/actions/mentorloop";
import { EMPTY_FORM_STATE } from "@/lib/action-state";
import { formatDateTime, formatTime } from "@/lib/utils";
import type { GroupMessage, Profile } from "@/types";

export function ChatPanel({
  groupId,
  messages,
  profile,
  attachmentUrls,
  demo,
}: {
  groupId: string;
  messages: GroupMessage[];
  profile: Profile;
  attachmentUrls: Record<string, string | null>;
  demo: boolean;
}) {
  const [state, formAction] = useActionState(sendMessageAction, EMPTY_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <div className="flex h-[640px] flex-col">
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-ink">No messages yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              Start the conversation. Only members of this group can read and send messages.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === profile.id;
            const attachments = message.attachments ?? [];
            return (
              <div key={message.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                <Avatar name={message.sender?.full_name ?? "Member"} size="sm" className={mine ? "bg-brand-teal text-navy-950" : ""} />
                <div className={`max-w-[78%] ${mine ? "items-end text-right" : ""} flex flex-col`}>
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted">
                    <span className="font-semibold text-slate-600">
                      {mine ? "You" : message.sender?.full_name ?? "Member"}
                    </span>
                    {message.sender?.role === "faculty" ? (
                      <span className="rounded bg-teal-100 px-1 py-0.5 text-[8px] font-bold uppercase text-teal-700">
                        Mentor
                      </span>
                    ) : null}
                    <span title={formatDateTime(message.created_at)}>{formatTime(message.created_at.slice(11, 16))}</span>
                  </div>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      mine
                        ? "rounded-tr-sm bg-navy-900 text-white"
                        : "rounded-tl-sm border border-line bg-white text-slate-700"
                    }`}
                  >
                    {message.body}
                  </div>
                  {attachments.map((attachment) => {
                    const url = attachmentUrls[attachment.id];
                    return url ? (
                      <Link
                        key={attachment.id}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:underline"
                      >
                        <Paperclip className="h-3 w-3" /> {attachment.file_name}
                      </Link>
                    ) : (
                      <span
                        key={attachment.id}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted"
                        title={demo ? "Demo attachment metadata only" : undefined}
                      >
                        <Paperclip className="h-3 w-3" /> {attachment.file_name}
                        {demo ? <span className="text-[8px]">(demo metadata)</span> : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line bg-white p-3">
        {state.error ? (
          <Alert tone="error" className="mb-2 py-2 text-xs">
            {state.error}
          </Alert>
        ) : null}
        <form ref={formRef} action={formAction} className="flex items-end gap-2">
          <input type="hidden" name="group_id" value={groupId} />
          <div className="min-w-0 flex-1">
            <textarea
              name="body"
              required
              rows={2}
              maxLength={2000}
              placeholder="Write a message…"
              className="focus-ring block w-full resize-none rounded-xl border border-line px-3 py-2 text-xs placeholder:text-slate-400"
            />
            <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[10px] text-muted hover:text-ink">
              <Paperclip className="h-3 w-3" />
              Attach file (≤ 5 MB)
              <input
                type="file"
                name="attachment"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.zip,.doc,.docx,.ppt,.pptx"
              />
            </label>
          </div>
          <SubmitButton pendingText="Sending…" size="md">
            <Send className="h-3.5 w-3.5" /> Send
          </SubmitButton>
        </form>
        <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400">
          <AlertCircle className="h-2.5 w-2.5" />
          Messages are visible to all group members. Attachments are validated by type and size.
        </p>
      </div>
    </div>
  );
}
