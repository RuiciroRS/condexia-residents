<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Condexia Residents — Agent Instructions

## Propósito

App PWA para **residentes** de condominios administrados con Condexia AI (`condo_admin`).
Los residentes pueden: ver y pagar su mantenimiento, subir comprobantes, reportar quejas y reservar zonas comunes.

Esta app es **completamente separada** de `condo_admin` — Supabase propio, repo propio, deploy propio.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.2.6 (App Router) |
| React | 19.2.4 |
| Estilos | Tailwind v4 (CSS-first, sin config JS) |
| Auth + DB + Storage | Supabase (`@supabase/ssr`) — proyecto **separado** de condo_admin |
| IA (futuro) | Anthropic SDK — validación automática de comprobantes. **No implementar hasta que el socio habilite la API key.** |

## Archivos clave — leer antes de tocar algo

| Archivo | Qué contiene |
|---------|-------------|
| `supabase/schema.sql` | Schema completo — fuente de verdad de la DB |
| `lib/supabase/client.ts` | Supabase browser client |
| `lib/supabase/server.ts` | Supabase server client (RSC + Route Handlers) |
| `proxy.ts` | Session refresh de Supabase SSR — no recrear ni duplicar. En Next.js 16 se llama `proxy.ts`, no `middleware.ts`. |
| `app/dashboard/page.tsx` | Dashboard del residente (una vez creado) |

## Routing

```
app/
  auth/
    login/page.tsx         — login de residentes
    invite/page.tsx        — residente llega con token, se registra
  dashboard/
    page.tsx               — home del residente
    payment/page.tsx       — pago de mantenimiento + subir comprobante
    complaints/page.tsx    — reportar queja
    areas/page.tsx         — reservar zona común
  api/
    auth/callback/route.ts — OAuth callback de Supabase
```

## Design system

> Colores provisionales — pendiente definición de brand de Condexia.

| Token | Valor |
|-------|-------|
| Sidebar bg | `#1B2E3C` |
| Brand teal | `#0D9488` |
| Page bg | `#F8FAFC` |
| Card bg | `#FFFFFF` |
| Border | `#E2E8F0` · siempre `0.5px` |
| Text primary | `#0F172A` |
| Text secondary | `#64748B` |
| Success (pagado) | `#10B981` |
| Warning (pendiente) | `#F59E0B` |
| Danger (rechazado) | `#EF4444` |

**Reglas:** solo `font-weight` 400 y 500. Sin emojis. Sin iconos decorativos.

## Schema DB (resumen)

```
condominiums (copia mínima de condo_admin — solo id + name)
  └── unit_types (subclases con fee mensual)
        └── units (cada depto/casa/local)
              └── residents (usuario ligado a su unidad)
                    ├── payment_records (comprobantes de pago por mes)
                    ├── complaints (quejas)
                    └── area_reservations → common_areas
```

RLS encadenado: cada residente solo ve su propio condominio/unidad/datos.
Ver `supabase/schema.sql` para políticas completas.

## Flujo de invitación (crítico — leer antes de tocar auth)

1. Admin en `condo_admin` genera link: `/auth/invite?token=<uuid>`
2. El token se guarda en `residents.invite_token` con `invite_expires_at`
3. Residente abre el link → `/auth/invite` → llena nombre/contraseña → se crea user en Supabase Auth → `residents.user_id` se actualiza → `status = 'active'`
4. Cualquier acceso al dashboard sin `residents.status = 'active'` redirige a `/auth/login`

## Regla de IA — comprobantes

`payment_records.status`:
- `pending` → no ha subido comprobante
- `submitted` → subió comprobante, esperando validación
- `approved` → validado (manual por ahora, automático con IA después)
- `rejected` → admin rechazó, `admin_notes` explica por qué

**No implementar validación automática hasta que se habilite la API key de Anthropic.**

## No tocar sin tarea explícita

- `proxy.ts`
- `supabase/schema.sql` (solo agregar, nunca borrar columnas/tablas)
- Flujo de invitación una vez que esté implementado

## Principio de diseño (Ruiciro, 2026-05-12)

> **Facilitar la vida al residente Y al admin lo más posible.**
> Cada feature debe reducir fricción para ambos lados.
