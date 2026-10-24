import Link from "next/link";
import { ArrowLeft, Filter, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { requireRole } from "@/lib/session";
import { listUsers } from "@/lib/data/admin";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatCard,
  TableShell,
} from "@/components/ui";
import { Avatar } from "@/components/ui";
import { RoleUpdateForm } from "./role-update-form";

export const metadata = { title: "User management" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const admin = await requireRole(["admin"]);
  const params = await searchParams;
  const q = params.q ?? "";
  const role = params.role ?? "all";
  const [users, allUsers] = await Promise.all([listUsers({ q, role }), listUsers()]);

  return (
    <div>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Admin console
      </Link>
      <PageHeader
        eyebrow="Administration"
        title="User management"
        description="View campus accounts and grant faculty or administrator access. Every change is audited."
        actions={<Badge tone="navy"><ShieldCheck className="h-3 w-3" /> Admin only</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total accounts" value={allUsers.length} icon={<Users className="h-5 w-5" />} tone="blue" />
        <StatCard
          label="Faculty"
          value={allUsers.filter((user) => user.role === "faculty").length}
          icon={<UserRound className="h-5 w-5" />}
          tone="teal"
        />
        <StatCard
          label="Administrators"
          value={allUsers.filter((user) => user.role === "admin").length}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="orange"
        />
      </div>

      <Card className="mt-5">
        <form method="GET" className="flex flex-col gap-2 p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search name, email or roll number…"
              className="pl-9"
              aria-label="Search users"
            />
          </div>
          <Select name="role" defaultValue={role} className="sm:w-44" aria-label="Filter by role">
            <option value="all">All roles</option>
            <option value="student">Students</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Administrators</option>
          </Select>
          <Button type="submit" variant="primary">
            <Filter className="h-3.5 w-3.5" /> Filter
          </Button>
          {q || role !== "all" ? (
            <Link
              href="/admin/users"
              className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs text-slate-500 hover:bg-slate-50"
            >
              Reset
            </Link>
          ) : null}
        </form>
      </Card>

      <div className="mt-4">
        {users.length === 0 ? (
          <Card>
            <EmptyState title="No users found" description="Try a different search or role filter." />
          </Card>
        ) : (
          <TableShell>
            <thead>
              <tr className="border-b border-line bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Roll no.</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Current role</th>
                <th className="px-4 py-3 font-semibold">Change role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((user) => (
                <tr key={user.id} className="text-xs">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={user.full_name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{user.full_name}</p>
                        <p className="truncate text-[10px] text-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.department?.code ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{user.roll_number ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[10px] text-muted">
                    {formatDate(user.created_at, "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={user.role === "admin" ? "orange" : user.role === "faculty" ? "teal" : "blue"}
                    >
                      {ROLE_LABEL[user.role]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <RoleUpdateForm userId={user.id} role={user.role} isSelf={user.id === admin.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>

      <Card className="mt-4 p-4">
        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          Roles are enforced by PostgreSQL Row Level Security and a security-definer function validates that
          the caller is an administrator before changing a role. You cannot change your own role, and the
          last administrator cannot be demoted.
        </p>
      </Card>
    </div>
  );
}
