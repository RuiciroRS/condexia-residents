"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=/auth/update-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });

    if (error) {
      setError("No se pudo enviar el correo. Verifica el email e intenta de nuevo.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-[#1B2E3C] text-2xl font-medium tracking-tight">Condexia</span>
          <p className="mt-1 text-sm text-[#64748B]">Portal de residentes</p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          {sent ? (
            <div className="text-center">
              <p className="text-[#0F172A] text-lg font-medium mb-2">Correo enviado</p>
              <p className="text-sm text-[#64748B]">
                Revisa tu bandeja de entrada y haz clic en el link para crear una nueva contraseña.
                El link expira en 24 horas.
              </p>
              <a
                href="/auth/login"
                className="mt-4 block text-sm text-[#0D9488] underline underline-offset-2"
              >
                Volver al inicio de sesión
              </a>
            </div>
          ) : (
            <>
              <h1 className="text-[#0F172A] text-lg font-medium mb-1">Recuperar contraseña</h1>
              <p className="text-sm text-[#64748B] mb-5">
                Te enviaremos un link para crear una nueva contraseña.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
                    placeholder="tu@correo.com"
                  />
                </div>
                {error && <p className="text-xs text-[#EF4444]">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] transition-colors disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar link"}
                </button>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <p className="mt-4 text-center text-xs text-[#64748B]">
            <a href="/auth/login" className="text-[#0D9488] underline">
              Volver al inicio de sesión
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
