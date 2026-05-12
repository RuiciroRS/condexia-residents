"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ComplaintsSection from "./complaints-section";
import AreasSection from "./areas-section";

type Resident = {
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

type Payment = {
  id: string;
  status: string;
  amount: number;
  submitted_at: string | null;
  admin_notes: string | null;
} | null;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-[#F59E0B]" },
  submitted: { label: "En revisión", color: "text-[#64748B]" },
  approved: { label: "Pagado", color: "text-[#10B981]" },
  rejected: { label: "Rechazado", color: "text-[#EF4444]" },
};

export default function DashboardClient({
  resident,
  currentPayment,
}: {
  resident: Resident;
  currentPayment: Payment;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [activeSection, setActiveSection] = useState<"home" | "payment" | "complaints" | "areas">("home");
  const [uploading, setUploading] = useState(false);
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

            {payment?.status !== "approved" && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                <p className="text-sm font-medium text-[#0F172A] mb-2">
                  Subir comprobante
                </p>
                <p className="text-xs text-[#64748B] mb-4">
                  Sube la foto o captura de tu transferencia, OXXO o CoDi.
                  El administrador lo revisará y confirmará tu pago.
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
                    El administrador lo esta revisando.
                  </p>
                )}
              </div>
            )}
          </div>
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
