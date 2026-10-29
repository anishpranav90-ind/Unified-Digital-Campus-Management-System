import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Inbox } from "lucide-react";
import { cn, initials } from "@/lib/utils";

const BUTTON_VARIANTS = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm",
  accent: "bg-brand-orange text-white hover:bg-brand-orange-dark shadow-sm",
  secondary: "border border-line bg-white text-ink hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  soft: "bg-blue-50 text-blue-700 hover:bg-blue-100",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2",
  icon: "h-9 w-9",
} as const;

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
} = {}) {
  return cn(
    "focus-ring inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return <button className={buttonStyles({ variant, size, className })} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />;
}

const BADGE_TONES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  navy: "bg-navy-900 text-white ring-navy-800",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        BADGE_TONES[tone] ?? BADGE_TONES.slate,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-white shadow-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line p-5", className)}>
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 rounded-lg bg-slate-50 p-2 text-slate-600">{icon}</div> : null}
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

const CONTROL =
  "focus-ring w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 disabled:bg-slate-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-10", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(CONTROL, "h-10", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-24 resize-y", className)} {...props} />;
}

export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "info" | "warning";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm", styles, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "navy",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "navy" | "orange" | "blue" | "green" | "amber" | "teal";
  href?: string;
}) {
  const tones = {
    navy: "bg-navy-900/5 text-navy-800",
    orange: "bg-orange-50 text-brand-orange",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    teal: "bg-teal-50 text-teal-600",
  }[tone];

  const content = (
    <Card className={cn("h-full p-5 transition-shadow", href && "hover:shadow-lift")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        {icon ? <div className={cn("rounded-xl p-2.5", tones)}>{icon}</div> : null}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" }[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-navy-900 font-semibold text-white",
        sizes,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-navy-900 bg-navy-900 text-white"
          : "border-line bg-white text-slate-600 hover:border-slate-300 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-line bg-white", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
