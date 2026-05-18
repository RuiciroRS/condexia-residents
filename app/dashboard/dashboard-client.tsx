"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ComplaintsSection from "./complaints-section";
import AreasSection from "./areas-section";
import AnnouncementsSection from "./announcements-section";

export type Resident = {
  id: string;
  name: string;
  units: {
    id: string;
    number: string;
    condominium_id: string;
    unit_types: { name: string; fee: number } | null;
    condominiums: { id: string; name: string } | null;
  } | null;
};

export type Payment = {
  id: string;
  status: string;
  amount: number;
  submitted_at: string | null;
  receipt_url: string | null;
  admin_notes: string | null;
} | null;

export type PaymentRecord = {
  id: string;
  period_month: number;
  period_year: number;
  amount: number;
  status: string;
  receipt_url: string | null;
  submitted_at: string | null;
  admin_notes: string | null;
};

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-[#F59E0B]" },
  submitted: { label: "En revisión", color: "text-[#64748B]" },
  approved: { label: "Pagado", color: "text-[#10B981]" },
  rejected: { label: "Rechazado", color: "text-[#EF4444]" },
};

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatPeriod(month: number, year: number): string {
  return `${MONTHS_ES[(month - 1) % 12] ?? month} ${year}`;
}

export default function DashboardClient({
  resident,
  currentPayment,
  paymentHistory,
}: {
  resident: Resident;
  currentPayment: Payment;
  paymentHistory: PaymentRecord[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [activeSection, setActiveSection] = useState<"home" | "payment" | "complaints" | "areas" | "announcements">("home");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function registerPush() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (Notification.permission === "denied") return;

        const permission =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();
        if (permission !== "granted") return;

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;

        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(vapidKey),
          }));

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        // Non-fatal — push is optional
      }
    }

    void registerPush();
  }, []);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment>(currentPayment);

  const unit = resident.units;
  const fee = unit?.unit_types?.fee ?? 0;
  const condoName = unit?.condominiums?.name ?? "Mi condominio";
  const now = new Date();
  const monthLabel = now.toLocaleString("es-MX", { month: "long", year: "numeric" });

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const ext = file.name.split(".").pop();
    const path = `${resident.id}/${now.getFullYear()}-${now.getMonth() + 1}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploadError("Error al subir el comprobante. Intenta de nuevo.");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(path);

    // Crear o actualizar el payment_record del mes
    const upsertData = {
      resident_id: resident.id,
      unit_id: unit?.id ?? "",
      period_month: now.getMonth() + 1,
      period_year: now.getFullYear(),
      amount: fee,
      status: "submitted",
      receipt_url: publicUrl,
      submitted_at: new Date().toISOString(),
    };

    if (payment?.id) {
      await supabase.from("payment_records").update({
        status: "submitted",
        receipt_url: publicUrl,
        submitted_at: new Date().toISOString(),
      }).eq("id", payment.id);
    } else {
      const { data } = await supabase.from("payment_records").insert(upsertData).select().single();
      if (data) setPayment(data);
    }

    setPayment((prev) => prev
      ? { ...prev, status: "submitted", submitted_at: new Date().toISOString() }
      : null
    );
    setUploading(false);
  }

  const paymentStatus = STATUS_LABEL[payment?.status ?? "pending"];

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1B2E3C] flex flex-col shrink-0">
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <p className="text-white text-sm font-medium">{condoName}</p>
          <p className="text-white/50 text-xs mt-0.5">Depto. {unit?.number}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { id: "home", label: "Inicio" },
            { id: "payment", label: "Mi pago" },
            { id: "announcements", label: "Avisos" },
            { id: "complaints", label: "Quejas" },
            { id: "areas", label: "Zonas comunes" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as typeof activeSection)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === item.id
                  ? "bg-[#0D9488] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-5">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeSection === "home" && (
          <div>
            <h1 className="text-xl font-medium text-[#0F172A] mb-1">
              Hola, {resident.name.split(" ")[0]}
            </h1>
            <p className="text-sm text-[#64748B] mb-6">
              {condoName} · Depto. {unit?.number}
            </p>

            {/* Card pago del mes */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 max-w-sm mb-4">
              <p className="text-xs text-[#64748B] uppercase tracking-wide mb-3">
                Mantenimiento — {monthLabel}
              </p>
              <p className="text-2xl font-medium text-[#0F172A] mb-1">
                ${fee.toLocaleString("es-MX")} MXN
              </p>
              <p className={`text-sm font-medium ${paymentStatus.color}`}>
                {paymentStatus.label}
              </p>
              {payment?.status === "rejected" && payment.admin_notes && (
                <p className="mt-2 text-xs text-[#64748B] bg-[#FEF2F2] rounded-lg p-2">
                  {payment.admin_notes}
                </p>
              )}
              <button
                onClick={() => setActiveSection("payment")}
                className="mt-4 w-full py-2 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] transition-colors"
              >
                {payment?.status === "approved" ? "Ver comprobante" : "Pagar / Subir comprobante"}
              </button>
            </div>

            {/* Últimos pagos en home */}
            {paymentHistory.length > 0 && (
              <div className="max-w-sm mt-4">
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">Últimos pagos</p>
                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {paymentHistory.slice(0, 3).map((record, idx) => {
                    const st = STATUS_LABEL[record.status] ?? { label: record.status, color: "text-[#64748B]" };
                    return (
                      <div
                        key={record.id}
                        className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t border-[#E2E8F0]" : ""}`}
                      >
                        <span className="text-sm text-[#64748B] capitalize">
                          {formatPeriod(record.period_month, record.period_year)}
                        </span>
                        <span className={`text-sm font-medium ${st.color}`}>{st.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "payment" && (
          <div className="max-w-md">
            <h2 className="text-lg font-medium text-[#0F172A] mb-1">Mi pago</h2>
            <p className="text-sm text-[#64748B] mb-6">
              Mantenimiento de {monthLabel}
            </p>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[#64748B]">Cuota mensual</span>
                <span className="text-sm font-medium text-[#0F172A]">
                  ${fee.toLocaleString("es-MX")} MXN
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#64748B]">Estado</span>
                <span className={`text-sm font-medium ${paymentStatus.color}`}>
                  {paymentStatus.label}
                </span>
              </div>
            </div>

            {payment?.status === "approved" && payment.receipt_url ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                <p className="text-sm font-medium text-[#0F172A] mb-2">Comprobante</p>
                <a
                  href={payment.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#0D9488] underline underline-offset-2"
                >
                  Ver comprobante aprobado
                </a>
              </div>
            ) : payment?.status !== "approved" ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                <p className="text-sm font-medium text-[#0F172A] mb-2">
                  {payment?.status === "rejected" ? "Volver a subir comprobante" : "Subir comprobante"}
                </p>
                <p className="text-xs text-[#64748B] mb-4">
                  {payment?.status === "rejected"
                    ? "Tu comprobante anterior fue rechazado. Sube uno nuevo para que el administrador lo revise."
                    : "Sube la foto o captura de tu transferencia, OXXO o CoDi. El administrador lo revisará y confirmará tu pago."}
                </p>

                <label className="block">
                  <span className="sr-only">Seleccionar comprobante</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleReceiptUpload}
                    disabled={uploading || payment?.status === "submitted"}
                    className="block w-full text-sm text-[#64748B] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#0D9488] file:text-white hover:file:bg-[#0f766e] disabled:opacity-50"
                  />
                </label>

                {uploading && (
                  <p className="mt-2 text-xs text-[#64748B]">Subiendo comprobante...</p>
                )}
                {uploadError && (
                  <p className="mt-2 text-xs text-[#EF4444]">{uploadError}</p>
                )}
                {payment?.status === "submitted" && (
                  <p className="mt-3 text-xs text-[#64748B] bg-[#F8FAFC] rounded-lg p-2">
                    Comprobante recibido el {new Date(payment.submitted_at!).toLocaleDateString("es-MX")}.
                    El administrador lo está revisando.
                  </p>
                )}
              </div>
            ) : null}

            {/* Historial de pagos */}
            <div className="mt-6">
              <p className="text-sm font-medium text-[#0F172A] mb-3">Historial de pagos</p>
              {paymentHistory.length === 0 ? (
                <p className="text-sm text-[#64748B]">Sin pagos anteriores registrados.</p>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0]">
                        <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Período</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Monto</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Estado</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-[#64748B] uppercase tracking-wide">Comprobante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {paymentHistory.map((record) => {
                        const st = STATUS_LABEL[record.status] ?? { label: record.status, color: "text-[#64748B]" };
                        return (
                          <tr key={record.id} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-4 py-3 text-[#0F172A] capitalize">
                              {formatPeriod(record.period_month, record.period_year)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-[#0F172A]">
                              ${record.amount.toLocaleString("es-MX")}
                            </td>
                            <td className={`px-4 py-3 font-medium ${st.color}`}>
                              {st.label}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {record.receipt_url ? (
                                <a
                                  href={record.receipt_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#0D9488] underline underline-offset-2"
                                >
                                  Ver
                                </a>
                              ) : (
                                <span className="text-[#CBD5E1]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === "announcements" && (
          <AnnouncementsSection
            condominiumId={unit?.condominium_id ?? ""}
          />
        )}

        {activeSection === "complaints" && (
          <ComplaintsSection
            residentId={resident.id}
            unitId={unit?.id ?? ""}
            condominiumId={unit?.condominium_id ?? ""}
          />
        )}

        {activeSection === "areas" && (
          <AreasSection
            residentId={resident.id}
            unitId={unit?.id ?? ""}
            condominiumId={unit?.condominium_id ?? ""}
          />
        )}
      </main>
    </div>
  );
}
