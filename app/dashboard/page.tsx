import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: resident } = await supabase
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

  if (!resident || resident.status !== "active") {
    await supabase.auth.signOut()
    redirect("/auth/login")
  };

  // Pago del mes actual
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
      currentPayment={currentPayment}
    />
  );
}
