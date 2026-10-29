import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { APP_TAGLINE } from "@/lib/constants";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-white">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold leading-tight text-navy-900">UniSync</span>
              <span className="block text-[9px] uppercase tracking-[0.16em] text-muted">{APP_TAGLINE}</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to UniSync
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-4 py-6 text-[11px] text-muted sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} UniSync</p>
          <nav aria-label="Legal" className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-ink">
              Privacy policy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms and conditions
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
