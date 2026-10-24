import "server-only";
import type { Profile } from "@/types";
import { isDemoMode } from "@/lib/env";
import { getDemoStore } from "@/lib/demo/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  module: string;
};

export async function globalSearch(profile: Profile, query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: SearchResult[] = [];

  if (isDemoMode()) {
    const store = getDemoStore();
    store.opportunities
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.organization.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.includes(q)),
      )
      .slice(0, 4)
      .forEach((item) =>
        results.push({
          id: item.id,
          title: item.title,
          subtitle: `${item.organization} · deadline ${new Date(item.deadline).toLocaleDateString("en-IN")}`,
          href: `/opportune/${item.id}`,
          module: "Opportune",
        }),
      );

    store.announcements
      .filter((item) => item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((item) =>
        results.push({
          id: item.id,
          title: item.title,
          subtitle: "Announcement",
          href: "/announcements",
          module: "Announcements",
        }),
      );

    store.print_requests
      .filter(
        (item) =>
          (profile.role !== "student" || item.student_id === profile.id) &&
          (item.document_name.toLowerCase().includes(q) ||
            item.request_number.toLowerCase().includes(q)),
      )
      .slice(0, 3)
      .forEach((item) =>
        results.push({
          id: item.id,
          title: `${item.request_number} · ${item.document_name}`,
          subtitle: `PrintPulse · ${item.status}`,
          href: `/printpulse/${item.id}`,
          module: "PrintPulse",
        }),
      );

    store.maintenance_requests
      .filter(
        (item) =>
          (profile.role !== "student" || item.student_id === profile.id) &&
          (item.title.toLowerCase().includes(q) || item.ticket_number.toLowerCase().includes(q)),
      )
      .slice(0, 3)
      .forEach((item) =>
        results.push({
          id: item.id,
          title: `${item.ticket_number} · ${item.title}`,
          subtitle: `Fixora · ${item.status.replace("_", " ")}`,
          href: `/fixora/${item.id}`,
          module: "Fixora",
        }),
      );

    store.mentor_groups
      .filter((item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((item) =>
        results.push({
          id: item.id,
          title: item.name,
          subtitle: "MentorLoop group",
          href: `/mentorloop/${item.id}`,
          module: "MentorLoop",
        }),
      );

    return results.slice(0, 12);
  }

  const supabase = await createSupabaseServerClient();
  const safe = q.replace(/[%,()]/g, " ").trim();
  const [opportunities, announcements, prints, maintenance, groups] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, organization, deadline")
      .or(`title.ilike.%${safe}%,organization.ilike.%${safe}%`)
      .limit(4),
    supabase
      .from("announcements")
      .select("id, title")
      .ilike("title", `%${safe}%`)
      .limit(3),
    supabase
      .from("print_requests")
      .select("id, request_number, document_name, status")
      .or(`document_name.ilike.%${safe}%,request_number.ilike.%${safe}%`)
      .limit(3),
    supabase
      .from("maintenance_requests")
      .select("id, ticket_number, title, status")
      .or(`title.ilike.%${safe}%,ticket_number.ilike.%${safe}%`)
      .limit(3),
    supabase.from("mentor_groups").select("id, name, description").ilike("name", `%${safe}%`).limit(3),
  ]);

  (opportunities.data ?? []).forEach((item) =>
    results.push({
      id: item.id as string,
      title: item.title as string,
      subtitle: `${item.organization} · deadline ${new Date(item.deadline as string).toLocaleDateString("en-IN")}`,
      href: `/opportune/${item.id}`,
      module: "Opportune",
    }),
  );
  (announcements.data ?? []).forEach((item) =>
    results.push({
      id: item.id as string,
      title: item.title as string,
      subtitle: "Announcement",
      href: "/announcements",
      module: "Announcements",
    }),
  );
  (prints.data ?? []).forEach((item) =>
    results.push({
      id: item.id as string,
      title: `${item.request_number} · ${item.document_name}`,
      subtitle: `PrintPulse · ${item.status}`,
      href: `/printpulse/${item.id}`,
      module: "PrintPulse",
    }),
  );
  (maintenance.data ?? []).forEach((item) =>
    results.push({
      id: item.id as string,
      title: `${item.ticket_number} · ${item.title}`,
      subtitle: `Fixora · ${String(item.status).replace("_", " ")}`,
      href: `/fixora/${item.id}`,
      module: "Fixora",
    }),
  );
  (groups.data ?? []).forEach((item) =>
    results.push({
      id: item.id as string,
      title: item.name as string,
      subtitle: "MentorLoop group",
      href: `/mentorloop/${item.id}`,
      module: "MentorLoop",
    }),
  );
  return results.slice(0, 12);
}
