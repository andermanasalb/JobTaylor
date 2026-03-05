# JobTaylor — Estado del proyecto y roadmap

---

## Estado actual de stages

### Stage 0 — In-memory ✅ COMPLETADO
- UI shell + routing + pantallas mockeadas
- Domain types, ports e implementaciones in-memory
- CV Base CRUD
- Job Postings (pegar oferta manualmente)
- Tailoring con `FakeAiClient` (determinista, sin red)
- Export PDF/DOCX desde JSON
- 82 unit tests verdes (Vitest)
- E2E básico (Playwright)

### Stage 1 — Supabase local ✅ COMPLETADO
- Supabase CLI + Docker en local
- Migraciones SQL para `base_cvs`, `job_postings`, `tailored_cvs`, `history_entries`
- RLS user-scoped (cada usuario solo ve sus propios datos)
- Repositorios Supabase implementando los mismos ports que in-memory
- Composition root con swap memory ↔ Supabase via `VITE_USE_SUPABASE`

### Stage 1.5 — Madurez de la aplicación ✅ COMPLETADO
- Auth completa: login + registro con email/password via Supabase Auth
- Seguridad OWASP: `validatePassword`, `PasswordInput` con barra de fortaleza, rate limiting (3 intentos → 60s), sin user enumeration, `returnTo`
- CV pre-rellenado en el primer login (nombre + email del usuario)
- Light/dark mode con persistencia
- Settings page: preferencias de idioma y proveedor de IA
- i18n completo ES/EN con react-i18next
- 102 unit tests verdes
- 49 tests E2E cubriendo flujo completo con auth
- Quality gate: `lint → typecheck → test` + Husky hooks

### Stage 1.6 — MVP funcional completo ✅ COMPLETADO
- Búsqueda real de ofertas via Adzuna API con infinite scroll
- Filtros por palabras clave, ubicación y categoría
- Cola de generación global (`GenerationQueueContext`): múltiples tailorings en paralelo
- `OllamaAiClient` conectado via proxy Express (`localhost:3001`)
- Campo `url` en `HistoryEntry` para enlazar a la oferta original
- Historial con filtros dinámicos (estado, región, búsqueda libre)
- Botón de exportación en historial (PDF/DOCX)

---

## Próximos pasos

### Decisión pendiente — Proveedor de IA para producción
Ollama funciona en local pero no es desplegable directamente en Vercel (requiere servidor propio).
Opciones barajadas:
- **Gemini API** (Google) — tier gratuito generoso, fácil integración, desplegable
- **OpenAI API** — más conocida, tier de pago
- **Mantener Ollama** — solo válido si se despliega en un VPS con Ollama instalado

### Stage 2 — Supabase Cloud ⏸ PENDIENTE
- Crear proyecto en Supabase Cloud
- Migrar schema + RLS al cloud
- Configurar proveedor de email real (Resend o SendGrid) para verificación
- Verificar RLS en cloud
- "Olvidé mi contraseña" / password reset (requiere email real configurado)

### Stage 3 — Vercel Deploy ⏸ PENDIENTE (depende de Stage 2 y decisión de IA)
- Deploy del frontend en Vercel conectado a Supabase Cloud
- Mover las claves de Adzuna a una Vercel serverless function (nunca en el bundle del frontend)
- Añadir URL de despliegue al README.md
- `docs/deploy.md` con checklist completo de variables de entorno

---

## Deferred (fuera del alcance actual)

- **OAuth / Google login** — requiere URL pública, deferred a Stage 2+
- **2FA** — requiere Supabase Cloud, deferred a Stage 2+
- **Stripe / pagos** — deferred indefinidamente, no es objetivo del TFM
- **LinkedIn OAuth** — importar perfil para pre-rellenar CV Base
- **Ranking IA de ofertas** — scoring de compatibilidad CV-oferta antes de tailorear

---

## Ideas futuras de mejora

- Puntuación de compatibilidad (0–100%) entre CV y oferta, visible antes de tailorear
- Editor de CV visual con vista previa en tiempo real
- Historial de versiones del CV Base (evolución a lo largo del tiempo)
- Multi-CV: varias versiones base (ej. una para frontend, otra para fullstack)
- Análisis de gaps: dashboard de skills que faltan para las ofertas más frecuentes
- Notificaciones cuando aparezcan nuevas ofertas que encajen con el perfil
