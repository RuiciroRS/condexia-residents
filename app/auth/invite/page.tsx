"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const token = searchParams.get("token");

  const [resident, setResident] = useState<{ id: string; name: string; unit_id: string } | null>(null);
  const [condoName, setCondoName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Link de invitación inválido.");
      setLoading(false);
      return;
    }

    async function validateToken() {
      const { data, error } = await supabase
        .from("residents")
        .select("id, name, unit_id, invite_expires_at, status, units(condominium_id, condominiums(name))")
        .eq("invite_token", token)
        .single();

      if (error || !data) {
        setError("Este link de invitación no existe o ya fue usado.");
        setLoading(false);
        return;
      }

      if (data.status === "active") {
        setError("Esta cuenta ya fue activada. Inicia sesión.");
        setLoading(false);
        return;
      }

      if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
        setError("Este link de invitación ha expirado. Pide uno nuevo al administrador.");
        setLoading(false);
        return;
      }

      setResident({ id: data.id, name: data.name, unit_id: data.unit_id });
      // @ts-expect-error nested select type
      setCondoName(data.units?.condominiums?.name ?? "tu condominio");
      setLoading(false);
    }

    validateToken();
  }, [token]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!resident) return;

    setSubmitting(true);
    setError(null);

    // Buscar el email del residente para registrarlo
    const { data: residentData } = await supabase
      .from("residents")
      .select("email")
      .eq("id", resident.id)
      .single();

    if (!residentData?.email) {
      setError("No se encontró el correo del residente. Contacta al administrador.");
      setSubmitting(false);
      return;
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: residentData.email,
      password,
    });

    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? "Error al crear la cuenta.");
      setSubmitting(false);
      return;
    }

    // Ligar user_id al residente y marcar activo
    await supabase
      .from("residents")
      .update({
        user_id: authData.user.id,
        status: "active",
        invite_token: null,
      })
      .eq("id", resident.id);

    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[#64748B]">Validando invitación...</p>
      </div>
    );
  }

  if (error && !resident) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-xl p-6 text-center">
          <p className="text-sm text-[#EF4444] mb-4">{error}</p>
          <a href="/auth/login" className="text-sm text-[#0D9488] underline">
            Ir al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-[#1B2E3C] text-2xl font-medium tracking-tight">
            Condexia
          </span>
          <p className="mt-1 text-sm text-[#64748B]">Bienvenido a {condoName}</p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          <h1 className="text-[#0F172A] text-lg font-medium mb-1">
            Hola, {resident?.name}
          </h1>
          <p className="text-sm text-[#64748B] mb-5">
            Crea tu contraseña para acceder al portal.
          </p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs text-[#64748B] mb-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
                placeholder="Repite la contraseña"
              />
            </div>

            {error && <p className="text-xs text-[#EF4444]">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] transition-colors disabled:opacity-50"
            >
              {submitting ? "Creando cuenta..." : "Activar mi cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
