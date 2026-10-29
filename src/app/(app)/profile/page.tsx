import { GraduationCap, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { listPrintRequests } from "@/lib/data/printpulse";
import { listMaintenanceRequests } from "@/lib/data/fixora";
import { getSavedOpportunities } from "@/lib/data/opportune";
import { logoutAction } from "@/lib/actions/auth";
import { Avatar, Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { isDemoMode } from "@/lib/env";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const [prints, complaints, saved] = await Promise.all([
    listPrintRequests(profile, { limit: 200 }),
    listMaintenanceRequests(profile),
    getSavedOpportunities(profile, 100),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Your UniSync identity, campus details and module preferences."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="h-20 bg-navy-950" />
            <div className="px-5 pb-5">
              <div className="-mt-6 flex items-end justify-between">
                <Avatar name={profile.full_name} size="lg" className="h-16 w-16 border-4 border-white text-base" />
                <Badge tone={profile.role === "admin" ? "orange" : profile.role === "faculty" ? "teal" : "blue"}>
                  {ROLE_LABEL[profile.role]}
                </Badge>
              </div>
              <h2 className="mt-3 text-base font-semibold text-ink">{profile.full_name}</h2>
              <p className="text-xs text-muted">{profile.email}</p>
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Department</dt>
                  <dd className="text-right font-medium text-ink">{profile.department?.name ?? "Not set"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Roll number</dt>
                  <dd className="font-medium text-ink">{profile.roll_number ?? "Not set"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Semester</dt>
                  <dd className="font-medium text-ink">{profile.semester ?? "Not set"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Joined</dt>
                  <dd className="font-medium text-ink">{formatDate(profile.created_at, "MMM yyyy")}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title="Module activity" icon={<UserRound className="h-4 w-4" />} />
            <div className="grid grid-cols-3 divide-x divide-line text-center">
              <div className="px-2 py-4">
                <p className="text-xl font-semibold text-ink">{prints.length}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted">Print jobs</p>
              </div>
              <div className="px-2 py-4">
                <p className="text-xl font-semibold text-ink">{complaints.length}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted">Complaints</p>
              </div>
              <div className="px-2 py-4">
                <p className="text-xl font-semibold text-ink">{saved.length}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted">Saved</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-ink">Security & access</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  Your role is stored in the database and enforced with Row Level Security. You cannot change
                  your own role. Signing out clears your session cookie.
                </p>
                {isDemoMode() ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
                    Demo mode: profile changes live in server memory until restart.
                  </p>
                ) : null}
                <form action={logoutAction} className="mt-3">
                  <Button type="submit" variant="secondary" size="sm">
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Edit profile"
              description="Keep your contact details and interests current"
              icon={<GraduationCap className="h-4 w-4" />}
            />
            <ProfileForm profile={profile} />
          </Card>
        </div>
      </div>
    </div>
  );
}
