import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Privacy policy",
  description:
    "What UniSync records, why it records it, who can read it, and how to ask for a correction or deletion.",
};

const UPDATED = "25 October 2026";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <article>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Privacy policy</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        UniSync is operated by the campus IT team at your institution. This page describes exactly what
        the platform stores, why it stores it, and who is allowed to read it. It describes this software
        as deployed for your campus. Your institution may publish additional rules that also apply.
      </p>
      <p className="mt-3 text-xs text-slate-500">Last updated {UPDATED}</p>

      <Section id="data" title="What we record">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account details.</strong> Full name, college email address, department, semester, roll
            number, and the optional phone number and profile photo you add. Your password is handled by
            the authentication service and is never stored in the application&apos;s own tables.
          </li>
          <li>
            <strong>Files you upload.</strong> Print documents (PDF), maintenance photos, message
            attachments and announcement attachments. These go to private storage buckets, not to public
            links.
          </li>
          <li>
            <strong>Records you create.</strong> Print requests and their prices, timetable correction
            requests, mentor group messages and read receipts, opportunity bookmarks, maintenance reports,
            comments and status history.
          </li>
          <li>
            <strong>Operational records.</strong> Notifications, and an audit trail of privileged actions
            such as role changes, print status updates and complaint updates. Audit entries record who did
            what and when.
          </li>
          <li>
            <strong>Session data.</strong> A signed session cookie set by the authentication service, and
            ordinary web server request logs kept by the hosting provider.
          </li>
        </ul>
      </Section>

      <Section id="why" title="Why we process it">
        <p>
          To run the five campus services the platform provides, to show each person the information their
          role allows, to notify you about changes to your own records, and to keep an accountable trail of
          administrative actions. We do not use your data for advertising, profiling or resale.
        </p>
      </Section>

      <Section id="who" title="Who can read it">
        <p>
          Access is enforced in the database with Row Level Security, not only by hiding interface
          controls. In practice:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>You can read your own print requests, complaints, notifications and bookmarks.</li>
          <li>
            Print desk staff and administrators can read the print queue, and can open a document when they
            need to produce the job.
          </li>
          <li>
            Mentor group members can read that group&apos;s messages. People outside the group cannot see
            the group or its messages.
          </li>
          <li>
            Faculty see the classes they teach and the groups they mentor. Administrators see campus-wide
            operational data and the audit log.
          </li>
          <li>
            Signed-out visitors can read the department list used by the registration form, and nothing
            else.
          </li>
        </ul>
      </Section>

      <Section id="processors" title="Services we rely on">
        <p>
          Database, authentication, file storage and realtime updates are provided by Supabase, which hosts
          the data for this deployment. The application itself is hosted by the institution&apos;s chosen
          provider. Those providers process data on the institution&apos;s instructions.
        </p>
        <p>
          There are no advertising networks, analytics trackers, session recording tools or third-party AI
          services in this application. Fonts are bundled at build time, so no font request leaves your
          browser.
        </p>
      </Section>

      <Section id="retention" title="How long we keep it">
        <p>
          Account details and the records you create are kept while your account is active. Print documents
          stay in private storage until the print desk or an administrator removes them. Audit entries are
          kept because they exist to provide accountability.
        </p>
        <p>
          The current release has no automatic deletion schedule. If you want your account removed, contact
          campus IT. We will delete your profile and the content you own, and tell you if any record has to
          be kept for accountability.
        </p>
      </Section>

      <Section id="security" title="How it is protected">
        <p>
          Traffic is served over HTTPS. Sessions use httpOnly cookies. Every application table has Row
          Level Security, role checks are repeated on the server for privileged actions, and uploaded files
          live in private buckets reachable only through authenticated routes or short-lived signed links.
        </p>
      </Section>

      <Section id="rights" title="Your choices">
        <p>
          You can review and correct your name, phone number, semester and opportunity interests from your{" "}
          <Link href="/profile" className="font-medium text-brand-blue hover:underline">
            profile page
          </Link>
          . For a copy of your records, a correction you cannot make yourself, or deletion, contact campus
          IT. Where local law gives you further rights over your personal data, those rights apply.
        </p>
      </Section>

      <Section id="cookies" title="Cookies">
        <p>
          UniSync sets only the cookies needed to keep you signed in. There are no advertising or
          cross-site tracking cookies. Signing out ends the session.
        </p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>
          Material changes will be announced in the platform and reflected in the date at the top of this
          page. Continued use after a change means you accept the updated policy.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Questions about this policy or a request about your data should go to your campus IT service
          desk, which administers this deployment. The same desk handles account, role and access
          problems.
        </p>
      </Section>

      <p className="mt-10 border-t border-line pt-5 text-xs text-muted">
        See also the{" "}
        <Link href="/terms" className="font-medium text-brand-blue hover:underline">
          terms and conditions
        </Link>
        .
      </p>
    </article>
  );
}
