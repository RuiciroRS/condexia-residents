import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient, { type Resident, type Payment } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: raw } = await supabase
    .from("residents")
    .select(`
      id, name, status,
      units (
        id, number, condominium_id,
        unit_types ( name, fee ),
        condominiums ( id, name )
      )
    `)
    .eq("user_id", user.id)
    .single();

  if (!raw || raw.status !== "active") {
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  // Normalizar relaciones anidadas (Supabase las devuelve como array en el tipo inferido)
  const units = Array.isArray(raw.units) ? raw.units[0] : raw.units;
  const resident: Resident = {
    id: raw.id,
    name: raw.name,
    units: units ? {
      id: units.id,
      number: units.number,
      condominium_id: units.condominium_id,
      unit_types: Array.isArray(units.unit_types) ? units.unit_types[0] ?? null : units.unit_types,
      condominiums: Array.isArray(units.condominiums) ? units.condominiums[0] ?? null : units.condominiums,
    } : null,
  };

  const now = new Date();
  const { data: currentPayment } = await supabase
    .from("payment_records")
    .select("id, status, amount, submitted_at, admin_notes")
    .eq("resident_id", resident.id)
    .eq("period_month", now.getMonth() + 1)
    .eq("period_year", now.getFullYear())
    .maybeSingle();

  return (
    <DashboardClient
      resident={resident}
      currentPayment={currentPayment as Payment}
    />
  );
}
