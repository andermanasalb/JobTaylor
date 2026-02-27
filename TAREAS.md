# JobTaylor — Tareas y estado del proyecto

Aplicación web para adaptar tu CV a ofertas de empleo usando IA, con búsqueda personalizada de ofertas y exportación a PDF/DOCX.

---

## Stages — Estado del proyecto

### Stage 0 — In-memory ✅ DONE
- UI shell + routing + pantallas mockeadas
- Domain types, ports e implementaciones in-memory
- CV Base CRUD
- Job Postings (pegar oferta manualmente)
- Tailoring con `FakeAiClient` (determinista, sin red)
- Export PDF/DOCX desde JSON
- 82 unit tests verdes (Vitest)
- E2E básico (Playwright)

### Stage 1 — Supabase local ✅ DONE
- Supabase CLI + Docker en local
- Migraciones SQL para `base_cvs`, `job_postings`, `tailored_cvs`
- RLS permisivo inicial
- Repos Supabase implementando los mismos ports que in-memory
- Composition root con swap memory ↔ Supabase via `VITE_USE_SUPABASE`

### Stage 1.5 — App maturity ✅ DONE
- **Auth completa**: login + registro con email/password
- **Seguridad login**:
  - Validación OWASP en frontend (`validatePassword`: 12 chars, mayús, minús, número, especial)
  - Componente `PasswordInput` reutilizable con barra de fortaleza y requisitos en tiempo real
  - Rate limiting frontend (3 intentos → bloqueo 60s)
  - Confirmar contraseña en registro
  - Nombre completo en registro
  - Mensajes de error en español (sin user enumeration)
  - `returnTo` post-login
- **RLS user-scoped**: cada usuario solo ve sus propios datos
- **CV pre-rellenado**: al primer login se crea automáticamente un CV Base con el nombre y email del usuario
- **Light/dark mode**: toggle en LoginPage (default: light) y en sidebar
- **Settings page**: preferencias de usuario
- **E2E tests**: 49 tests cubriendo flujo completo con auth
- **Quality gate**: `lint → typecheck → test` automatizado + Husky hooks
- 102 unit tests verdes

### Stage 1.6 — MVP funcional completo 🔜 PRÓXIMO
- **Búsqueda real de ofertas** via Adzuna API (gratuita, key en `.env.local`)
  - Personalizada por skills, título y ubicación del CV Base del usuario
  - Resultados en SearchPage con botón "Adaptar CV a esta oferta"
  - Oferta seleccionada → guardada como JobPosting snapshot (flujo ya existente)
- **IA local** via Ollama (`OllamaAiClient`)
  - Corre en `localhost:11434`, sin coste, sin API key
  - Modelos recomendados: `mistral`, `llama3`, `phi3`
  - Implementa el mismo port `AiClient` que `FakeAiClient`
- **IA cloud** via OpenAI / Anthropic (`OpenAiClient`)
  - Key en `.env.local`, nunca en el frontend en producción
- **Selector de proveedor de IA** en Settings (`local` / `cloud` / `fake`)
- **Flujo end-to-end completo**:
  ```
  SearchPage → Adzuna (ofertas reales)
  → Usuario selecciona oferta
  → TailorPage → OllamaAiClient o OpenAiClient
  → CV tailoreado con guardrails
  → Export PDF/DOCX
  ```
- `FakeAiClient` se mantiene exclusivamente para tests unitarios

### Stage 2 — Supabase Cloud ⏸ DEFERRED
- Crear proyecto en Supabase Cloud
- Migrar schema + RLS al cloud
- Configurar proveedor de email real (SendGrid / Resend)
- Verificar RLS en cloud
- **"Olvidé mi contraseña"** / password reset (requiere email real)
- **OAuth / Google login** (requiere URL pública)
- **2FA** (requiere Supabase Cloud)

### Stage 3 — Vercel Deploy ⏸ DEFERRED
- Deploy del frontend conectado a Supabase Cloud
- Mover Adzuna API key a Vercel serverless function (nunca en frontend en producción)
- `docs/deploy.md` con checklist de variables de entorno

### Stage 4 — Stripe ⏸ DEFERRED
- Pagos + webhooks server-side únicamente
- No implementar hasta Stage 2-3 estables

### Stage 5 — Búsqueda inteligente completa ⏸ DEFERRED
- **LinkedIn OAuth** → importar perfil del usuario → pre-rellenar CV Base automáticamente
- **Ranking IA** de ofertas según CV Base (experiencia, skills, ubicación, preferencias)
- Experiencia de búsqueda personalizada completa

---

## Propuestas futuras de mejora

- **Historial de versiones de CV**: ver evolución del CV a lo largo del tiempo
- **Puntuación de compatibilidad**: score visible (0–100%) entre CV y oferta antes de tailorear
- **Editor de CV visual**: vista previa en tiempo real del CV mientras se edita
- **Notificaciones**: avisar cuando haya nuevas ofertas que encajen con el perfil
- **Multi-CV**: gestionar varias versiones base del CV (ej. una para frontend, otra para fullstack)
- **Análisis de gaps**: dashboard que muestre qué skills faltan para las ofertas más frecuentes

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + TypeScript + Vite |
| Estilos | Tailwind CSS v4 |
| Auth + DB | Supabase (local: Docker, cloud: deferred) |
| IA local | Ollama (Stage 1.6) |
| IA cloud | OpenAI / Anthropic (Stage 1.6) |
| Export | jsPDF + docx (client-side) |
| Tests unitarios | Vitest + Testing Library |
| Tests E2E | Playwright |
| Deploy | Vercel (Stage 3) |
| Pagos | Stripe (Stage 4) |

---

## Arquitectura

Clean Architecture con Ports & Adapters:

```
src/
  domain/          # Entidades y lógica pura. Sin React, sin red.
  application/     # Casos de uso + ports (interfaces). Sin Supabase SDK.
  infra/           # Implementaciones: memory, supabase, ai, export.
  features/        # Feature slices (auth, cv-base, job-postings, tailoring, settings, history)
  shared/          # Componentes y utilidades cross-cutting
  app/             # Composition root, router, contextos
```

Regla de dependencia: `UI → application → domain`. La infra implementa los ports, nunca al revés.

---

## Comandos

```bash
# Instalar dependencias
npm install

# Desarrollo (requiere Supabase local corriendo)
npm run dev

# Supabase local
npx supabase start
npx supabase db reset   # reinicia DB y re-aplica migraciones

# Tests
npm run test            # unit tests (Vitest)
npm run test:e2e        # E2E (Playwright)

# Calidad
npm run lint
npm run typecheck
npm run quality         # lint + typecheck + test
npm run verify          # quality + test:e2e + build

# Build
npm run build
npm run preview
```

---

## Variables de entorno

Crear `.env.local` (nunca subir a git):

```env
# Supabase local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon key del supabase start>
VITE_USE_SUPABASE=true

# Stage 1.6 — Adzuna (obtener en https://developer.adzuna.com)
VITE_ADZUNA_APP_ID=
VITE_ADZUNA_APP_KEY=

# Stage 1.6 — IA cloud (opcional)
VITE_OPENAI_API_KEY=

# Stage 1.6 — Proveedor de IA: fake | ollama | openai
VITE_AI_PROVIDER=fake
```

---

## Requisitos para Stage 1.6

- [Ollama](https://ollama.com) instalado localmente
- Modelo descargado: `ollama pull mistral`
- Cuenta gratuita en [Adzuna Developer](https://developer.adzuna.com)
