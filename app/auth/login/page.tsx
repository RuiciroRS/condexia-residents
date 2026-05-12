"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-[#1B2E3C] text-2xl font-medium tracking-tight">
            Condexia
          </span>
          <p className="mt-1 text-sm text-[#64748B]">Portal de residentes</p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          <h1 className="text-[#0F172A] text-lg font-medium mb-5">
            Inicia sesión
          </h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-[#64748B] mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
                placeholder="tu@correo.com"
              />
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg outline-none focus:border-[#0D9488] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-[#EF4444]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] transition-colors disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-[#64748B]">
          ¿Recibiste un link de invitación?{" "}
          <a href="/auth/invite" className="text-[#0D9488] underline">
            Regístrate aquí
          </a>
        </p>
      </div>
    </div>
  );
}
