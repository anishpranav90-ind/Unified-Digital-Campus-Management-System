import Link from "next/link";
import { ArrowLeft, CalendarDays, GraduationCap, MessagesSquare, Printer, ShieldCheck, Wrench } from "lucide-react";
import { APP_TAGLINE } from "@/lib/constants";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[0.95fr_1.05fr]">
      <div className="relative hidden overflow-hidden bg-navy-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.2),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(20,184,166,0.14),transparent_50%)]" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-tight">UniSync</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Campus operating system
              </span>
            </span>
          </Link>

          <h1 className="mt-16 max-w-md text-4xl font-semibold leading-tight">
            One Campus.
            <br />
            <span className="text-brand-orange">Everything in Sync.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
            Print queues, timetables, mentorship, opportunities and maintenance — connected in one secure
            platform for students, faculty and administrators.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            {[
              { icon: Printer, label: "PrintPulse", tone: "text-orange-400" },
              { icon: CalendarDays, label: "TimeGrid", tone: "text-blue-400" },
              { icon: MessagesSquare, label: "MentorLoop", tone: "text-teal-400" },
              { icon: Wrench, label: "Fixora", tone: "text-emerald-400" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <item.icon className={`h-4 w-4 ${item.tone}`} />
                <span className="text-xs font-medium text-slate-200">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
            Role-based access and PostgreSQL Row Level Security protect every record — including print
            documents and complaint photos.
          </div>
          <p className="mt-4 text-[10px] text-slate-500">{APP_TAGLINE}</p>
        </div>
      </div>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between p-5 sm:p-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-navy-900">UniSync</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
