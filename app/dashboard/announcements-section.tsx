"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

export default function AnnouncementsSection({ condominiumId }: { condominiumId: string }) {
  const supabase = createClient();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .eq("condominium_id", condominiumId)
        .order("created_at", { ascending: false })
        .limit(20);
      setAnnouncements((data as Announcement[]) ?? []);
      setLoading(false);
    }
    void load();
  }, [condominiumId, supabase]);

  return (
    <div>
      <h2 className="text-lg font-medium text-[#0F172A] mb-1">Avisos del condominio</h2>
      <p className="text-sm text-[#64748B] mb-6">Comunicados del administrador.</p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-[#E2E8F0] rounded w-2/3 mb-2" />
              <div className="h-3 bg-[#E2E8F0] rounded w-full" />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-center">
          <p className="text-sm text-[#64748B]">No hay avisos recientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-[#0F172A]">{a.title}</p>
                <p className="shrink-0 text-xs text-[#64748B]">{formatDate(a.created_at)}</p>
              </div>
              <p className="mt-1 text-sm text-[#64748B]">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
