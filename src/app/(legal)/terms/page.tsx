import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Terms and conditions",
  description:
    "The rules for using UniSync: accounts, acceptable use, uploaded content, print jobs, external links and liability.",
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

export default function TermsPage() {
  return (
    <article>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Terms and conditions</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        These terms govern the use of UniSync, the campus operations platform operated by the campus IT
        team at your institution. By signing in, or by using any part of the platform, you agree to them.
        If you do not agree, do not use the platform.
      </p>
      <p className="mt-3 text-xs text-slate-500">Last updated {UPDATED}</p>

      <Section id="accounts" title="Accounts">
        <p>
          UniSync accounts are for people enrolled at, or employed by, the institution: students, faculty
          and administrators. One account per person. Give accurate details when you register, and keep
          your department, semester and contact details current.
        </p>
        <p>
          You are responsible for activity under your account. Keep your password private and do not share
          your session. Tell campus IT immediately if you believe your account has been used by someone
          else.
        </p>
        <p>
          New registrations are created with the student role. Faculty and administrator access is granted
          by an administrator. Roles cannot be self-assigned, and every role change is recorded.
        </p>
      </Section>

      <Section id="acceptable-use" title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>attempt to read, change or delete records belonging to another person;</li>
          <li>upload unlawful, harmful or infringing material, or documents you have no right to print;</li>
          <li>use the platform to harass other members, or to send bulk unsolicited messages;</li>
          <li>probe, scan or overload the service, or attempt to bypass access controls;</li>
          <li>scrape the platform, or resell access to it or to the services it provides.</li>
        </ul>
        <p>
          Access controls are enforced in the database. Trying to work around them is a breach of these
          terms even when the attempt fails, and may be handled under the institution&apos;s disciplinary
          process.
        </p>
      </Section>

      <Section id="content" title="Content you submit">
        <p>
          You keep ownership of what you submit: documents, photos, messages, reports and requests. You
          grant the institution permission to store, process and display that content only to run the
          service, which includes showing it to the people your role and group membership allow.
        </p>
        <p>
          You confirm you have the right to upload what you submit. Administrators and moderators may
          remove content that breaches these terms or campus policy, and may restrict an account that
          repeatedly does so.
        </p>
        <p>
          Do not upload documents containing sensitive personal data about other people unless the
          institution has asked you to and the data is needed for the task.
        </p>
      </Section>

      <Section id="printing" title="Print jobs">
        <p>
          Print requests are priced from the page count you enter and the rates set by the print desk. You
          are responsible for the accuracy of the page count and the file you upload. Prices shown are the
          amount recorded against the job; payment happens at the print desk under campus rules.
        </p>
        <p>
          Print staff can open a submitted document in order to produce it. Jobs can fail for reasons
          outside our control, including paper, toner and printer faults. A failed job is handled by the
          print desk.
        </p>
        <p>
          In a demonstration or test deployment, printing is simulated and no paper is produced. The
          current printer mode is always shown in the PrintPulse settings panel. Do not treat a simulated
          job as proof that a document was physically printed.
        </p>
      </Section>

      <Section id="accuracy" title="Campus information and external links">
        <p>
          Timetables, exam schedules, announcements and opportunity listings are authoritative only when
          published by faculty or administrators. Corrections are handled through the correction request
          flow and the administrator console.
        </p>
        <p>
          Opportunity listings can link to websites outside UniSync. Those sites are not under our
          control, and a listing is not an endorsement. Check the destination before you apply, share
          personal details or pay a fee. Links are validated when published, but the destination can change
          afterwards.
        </p>
      </Section>

      <Section id="availability" title="Availability and changes">
        <p>
          The platform is provided on a best-effort basis. It can be unavailable during maintenance,
          upgrades, provider outages or network problems, and features can change as the campus&apos;s
          needs change. We do not guarantee uninterrupted or error-free operation.
        </p>
      </Section>

      <Section id="suspension" title="Suspension and termination">
        <p>
          The institution may suspend or close an account that breaches these terms, that is no longer
          eligible for campus access, or where required by law. You may stop using the platform at any
          time and ask campus IT to close your account. Sections that by their nature survive termination,
          including content ownership and liability, continue to apply.
        </p>
      </Section>

      <Section id="liability" title="Disclaimers and liability">
        <p>
          The platform is provided as it is. To the extent permitted by law, the institution does not
          warrant that the service will meet every requirement or that data will never be lost, and is not
          liable for indirect or consequential loss arising from use of the platform.
        </p>
        <p>
          Nothing in these terms limits liability that cannot be limited by law, and nothing removes your
          rights under applicable consumer or data protection law.
        </p>
      </Section>

      <Section id="law" title="Governing law">
        <p>
          These terms are governed by the laws of the jurisdiction in which your institution operates.
          Disputes are subject to the courts of that jurisdiction, unless local law requires otherwise.
        </p>
      </Section>

      <Section id="changes" title="Changes to these terms">
        <p>
          These terms can be updated as the platform changes. Material changes will be announced in the
          platform and reflected in the date at the top of this page. Continuing to use UniSync after a
          change means you accept the updated terms.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Questions about these terms, or about an account, role or access problem, should go to your
          campus IT service desk, which administers this deployment.
        </p>
      </Section>

      <p className="mt-10 border-t border-line pt-5 text-xs text-muted">
        See also the{" "}
        <Link href="/privacy" className="font-medium text-brand-blue hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </article>
  );
}
