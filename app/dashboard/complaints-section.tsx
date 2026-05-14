"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Complaint = {
  id: string;
  title: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
};

const STATUS = {
  open:        { label: "Abierta",      color: "bg-[#FEF3C7] text-[#92400E]" },
  in_progress: { label: "En proceso",   color: "bg-[#DBEAFE] text-[#1E40AF]" },
  resolved:    { label: "Resuelta",     color: "bg-[#D1FAE5] text-[#065F46]" },
  closed:      { label: "Cerrada",      color: "bg-[#F1F5F9] text-[#64748B]" },
};

export default function ComplaintsSection({
  residentId,
  unitId,
  condominiumId,
}: {
  residentId: string;
  unitId: string;
  condominiumId: string;
}) {
  const supabase = createClient();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  async function fetchComplaints() {
    const { data } = await supabase
      .from("complaints")
      .select("id, title, description, status, admin_notes, created_at, resolved_at")
      .eq("resident_id", residentId)
      .order("created_at", { ascending: false });
    setComplaints(data ?? []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);

    const { error } = await supabase.from("complaints").insert({
      resident_id: residentId,
      unit_id: unitId,
      condominium_id: condominiumId,
      title: title.trim(),
      description: description.trim(),
      status: "open",
    });

    if (error) {
      setError("No se pudo enviar la queja. Intenta de nuevo.");
      setSubmitting(false);
      return;
    }

    setTitle("");
    setDescription("");
    setShowForm(false);
    setSubmitting(false);
    fetchComplaints();
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-[#0F172A]">Quejas</h2>
          <p className="text-sm text-[#64748B]">Reporta problemas en tu condominio</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] transition-colors"
        >
          {showForm ? "Cancelar" : "Nueva queja"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#E2E8F0] rounded-xl p-5 mb-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Asunto</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Fuga de agua en pasillo"
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Descripción</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el problema con detalle..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors resize-none"
              />
            </div>
            {error && <p className="text-xs text-[#EF4444]">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] transition-colors disabled:opacity-50"
            >
              {submitting ? "Enviando..." : "Enviar queja"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#64748B]">Cargando...</p>
      ) : complaints.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-center">
          <p className="text-sm text-[#64748B]">No tienes quejas registradas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const s = STATUS[c.status as keyof typeof STATUS] ?? STATUS.open;
            return (
              <div key={c.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-[#0F172A] leading-tight">{c.title}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                    {s.label}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mb-2 leading-relaxed">{c.description}</p>
                {c.admin_notes && (
                  <div className="mb-2 rounded-lg bg-[#F0FDF9] border border-[#99F6E4] p-2.5">
                    <p className="text-xs font-medium text-[#0D9488] mb-0.5">Respuesta del administrador</p>
                    <p className="text-xs text-[#0F172A] leading-relaxed">{c.admin_notes}</p>
                  </div>
                )}
                <p className="text-xs text-[#C0C8D0]">
                  {new Date(c.created_at).toLocaleDateString("es-MX", {
                    day: "numeric", month: "long", year: "numeric"
                  })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
