"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import type { Profile } from "@/types";
import { ROLE_LABEL } from "@/lib/constants";
import { Avatar } from "@/components/ui";
import { logoutAction } from "@/lib/actions/auth";

export function ProfileMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex items-center gap-2 rounded-xl border border-line bg-white py-1 pl-1 pr-2 transition-colors hover:bg-slate-50"
        aria-label="Open profile menu"
      >
        <Avatar name={profile.full_name} size="sm" />
        <span className="hidden text-left sm:block">
          <span className="block max-w-32 truncate text-xs font-semibold leading-tight text-ink">
            {profile.full_name}
          </span>
          <span className="block text-[10px] leading-tight text-muted">{ROLE_LABEL[profile.role]}</span>
        </span>
        <ChevronDown className="hidden h-3 w-3 text-slate-400 sm:block" />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{profile.full_name}</p>
            <p className="truncate text-xs text-muted">{profile.email}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              <ShieldCheck className="h-3 w-3" />
              {ROLE_LABEL[profile.role]}
            </p>
          </div>
          <div className="p-1.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <UserRound className="h-4 w-4" /> My profile
            </Link>
            {profile.role === "admin" ? (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ShieldCheck className="h-4 w-4" /> Admin console
              </Link>
            ) : null}
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
