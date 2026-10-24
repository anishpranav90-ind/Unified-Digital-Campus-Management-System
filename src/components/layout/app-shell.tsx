"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessagesSquare,
  Printer,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { AppNotification, Profile } from "@/types";
import { MODULES, ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { RealtimeRefresh } from "@/components/realtime-refresh";

const ICONS = {
  Printer,
  CalendarDays,
  MessagesSquare,
  Trophy,
  Wrench,
} as const;

export function AppShell({
  profile,
  notifications,
  unreadNotifications,
  unreadMessages,
  demo,
  children,
}: {
  profile: Profile;
  notifications: AppNotification[];
  unreadNotifications: number;
  unreadMessages: number;
  demo: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primary = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: 0 },
    ...MODULES.map((module) => ({
      href: module.href,
      label: module.name,
      icon: ICONS[module.icon as keyof typeof ICONS],
      badge: module.key === "mentorloop" ? unreadMessages : 0,
    })),
  ];
  const campus = [
    { href: "/announcements", label: "Announcements", icon: Megaphone, badge: 0 },
    { href: "/notifications", label: "Notifications", icon: Bell, badge: unreadNotifications },
    { href: "/profile", label: "My profile", icon: UserRound, badge: 0 },
  ];
  const adminLinks =
    profile.role === "admin"
      ? [
          { href: "/admin", label: "Admin console", icon: ShieldCheck, badge: 0 },
          { href: "/admin/users", label: "User management", icon: Users, badge: 0 },
        ]
      : [];

  function NavItem({
    href,
    label,
    icon: Icon,
    badge,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: number;
  }) {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
          active
            ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
            : "text-slate-300 hover:bg-white/5 hover:text-white",
        )}
      >
        <Icon className={cn("h-4 w-4", active ? "text-brand-orange" : "text-slate-400 group-hover:text-slate-200")} />
        <span className="flex-1">{label}</span>
        {badge > 0 ? (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </Link>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-950">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight text-white">UniSync</span>
            <span className="block text-[9px] uppercase tracking-[0.16em] text-slate-400">Campus OS</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="scroll-thin flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Overview
          </p>
          {primary.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Campus
          </p>
          {campus.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>
        {adminLinks.length ? (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Administration
            </p>
            {adminLinks.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={profile.full_name} size="sm" className="bg-brand-teal text-navy-950" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{profile.full_name}</p>
            <p className="truncate text-[10px] text-slate-400">
              {ROLE_LABEL[profile.role]}
              {profile.department ? ` · ${profile.department.code}` : ""}
            </p>
          </div>
        </div>
        {demo ? (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-200">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" />
            Demo mode · simulated printing
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="focus-ring rounded-xl border border-line p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-1.5 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange text-white">
                <GraduationCap className="h-4 w-4" />
              </span>
              <span className="hidden text-sm font-bold sm:block">UniSync</span>
            </Link>
            <div className="min-w-0 flex-1 sm:flex-none">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden md:block">
                <RealtimeRefresh
                  demo={demo}
                  table="notifications"
                  channelKey={`notifications-${profile.id}`}
                  label="Live"
                />
              </div>
              <NotificationBell notifications={notifications} unread={unreadNotifications} />
              <ProfileMenu profile={profile} />
            </div>
          </div>
          {demo ? (
            <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-[10px] font-medium text-amber-800 sm:px-6">
              <FlaskConical className="h-3 w-3 shrink-0" />
              <span>
                Demonstration mode: data is stored in server memory and resets on restart. Print output is{" "}
                <strong>simulated</strong>; no physical printer is connected.
              </span>
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
