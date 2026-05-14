"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Area = {
  id: string;
  name: string;
  capacity: number | null;
  rules: string | null;
};

type Reservation = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  common_areas: { name: string } | { name: string }[] | null;
};

const TIME_SLOTS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
  "19:00", "20:00", "21:00", "22:00",
];

export default function AreasSection({
  residentId,
  unitId,
  condominiumId,
}: {
  residentId: string;
  unitId: string;
  condominiumId: string;
}) {
  const supabase = createClient();

  const [areas, setAreas] = useState<Area[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"reserve" | "mine">("reserve");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [areasRes, reservationsRes] = await Promise.all([
      supabase
        .from("common_areas")
        .select("id, name, capacity, rules")
        .eq("condominium_id", condominiumId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("area_reservations")
        .select("id, date, start_time, end_time, status, common_areas(name)")
        .eq("resident_id", residentId)
        .gte("date", today)
        .order("date")
        .order("start_time"),
    ]);

    setAreas(areasRes.data ?? []);
    setReservations(reservationsRes.data ?? []);
    setLoading(false);
  }

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedArea || !date || !startTime || !endTime) return;
    if (startTime >= endTime) {
      setError("La hora de fin debe ser después de la hora de inicio.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // Verificar conflictos
    const { data: conflicts } = await supabase
      .from("area_reservations")
      .select("id")
      .eq("common_area_id", selectedArea.id)
      .eq("date", date)
      .eq("status", "confirmed")
      .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

    if (conflicts && conflicts.length > 0) {
      setError("Ya hay una reserva en ese horario. Elige otro.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("area_reservations").insert({
      common_area_id: selectedArea.id,
      resident_id: residentId,
      unit_id: unitId,
      date,
      start_time: startTime,
      end_time: endTime,
      status: "confirmed",
    });

    if (error) {
      setError("No se pudo crear la reserva. Intenta de nuevo.");
      setSubmitting(false);
      return;
    }

    setSelectedArea(null);
    setDate("");
    setStartTime("");
    setEndTime("");
    setSubmitting(false);
    fetchData();
    setTab("mine");
  }

  async function handleCancel(id: string) {
    await supabase
      .from("area_reservations")
      .update({ status: "cancelled" })
      .eq("id", id);
    fetchData();
  }

  if (loading) {
    return <p className="text-sm text-[#64748B]">Cargando...</p>;
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-[#0F172A]">Zonas comunes</h2>
        <p className="text-sm text-[#64748B]">Reserva espacios del condominio</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#F1F5F9] rounded-lg p-1 w-fit">
        {(["reserve", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"
            }`}
          >
            {t === "reserve" ? "Reservar" : "Mis reservas"}
          </button>
        ))}
      </div>

      {tab === "reserve" && (
        <div>
          {areas.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-center">
              <p className="text-sm text-[#64748B]">
                El administrador aún no ha registrado zonas comunes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Selector de área */}
              {!selectedArea ? (
                areas.map((area) => (
                  <button
                    key={area.id}
                    onClick={() => setSelectedArea(area)}
                    className="w-full text-left bg-white border border-[#E2E8F0] rounded-xl p-4 hover:border-[#0D9488] transition-colors"
                  >
                    <p className="text-sm font-medium text-[#0F172A]">{area.name}</p>
                    {area.capacity && (
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Capacidad: {area.capacity} personas
                      </p>
                    )}
                    {area.rules && (
                      <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{area.rules}</p>
                    )}
                  </button>
                ))
              ) : (
                <form onSubmit={handleReserve} className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-[#0F172A]">{selectedArea.name}</p>
                    <button
                      type="button"
                      onClick={() => { setSelectedArea(null); setError(null); }}
                      className="text-xs text-[#64748B] hover:text-[#0F172A]"
                    >
                      Cambiar
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">Fecha</label>
                      <input
                        type="date"
                        required
                        min={today}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Hora inicio</label>
                        <select
                          required
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
                        >
                          <option value="">--</option>
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Hora fin</label>
                        <select
                          required
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
                        >
                          <option value="">--</option>
                          {TIME_SLOTS.filter((t) => t > startTime).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {error && <p className="text-xs text-[#EF4444]">{error}</p>}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] transition-colors disabled:opacity-50"
                    >
                      {submitting ? "Reservando..." : "Confirmar reserva"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "mine" && (
        <div>
          {reservations.filter((r) => r.status === "confirmed").length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-center">
              <p className="text-sm text-[#64748B]">No tienes reservas próximas.</p>
              <button
                onClick={() => setTab("reserve")}
                className="mt-3 text-sm text-[#0D9488] underline"
              >
                Hacer una reserva
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations
                .filter((r) => r.status === "confirmed")
                .map((r) => (
                  <div key={r.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">
                          {Array.isArray(r.common_areas) ? r.common_areas[0]?.name : r.common_areas?.name}
                        </p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {new Date(r.date + "T12:00:00").toLocaleDateString("es-MX", {
                            weekday: "long", day: "numeric", month: "long"
                          })}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancel(r.id)}
                        className="text-xs text-[#EF4444] hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
