# JobTaylor

> **Presentacion del proyecto:** [Presentacion JobTaylor.pptx](presentacion-ppt/Presentacion%20JobTaylor.pptx)

**JobTaylor** es una aplicación web que ayuda a los candidatos a adaptar su CV a ofertas de empleo concretas usando inteligencia artificial. La IA reescribe y reordena el contenido del CV Base para destacar lo más relevante de cara a cada oferta — sin inventar experiencia, títulos, fechas ni certificaciones.

---

## Descripción general

El flujo principal de la aplicación es el siguiente:

1. El usuario crea su **CV Base** introduciendo su experiencia real (o importando desde PDF o DOCX).
2. Busca **ofertas de empleo reales** a través de la API de Adzuna, con filtros por palabras clave, ubicación (buscador de ciudad libre) y modalidad remota.
3. Selecciona una oferta para ver sus detalles enriquecidos por IA y su puntuación de compatibilidad con su CV.
4. Lanza el **proceso de tailoring**: la IA adapta el CV Base a la oferta seleccionada, respetando guardrails estrictos que impiden fabricar información.
5. Descarga el CV adaptado en **PDF, DOCX o Markdown**.
6. Consulta el **historial** de CVs generados, con filtros por estado, región y búsqueda de texto.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS v4 + shadcn/ui + Radix UI |
| Routing | React Router v7 |
| Auth + DB | Supabase (local: Docker via Supabase CLI) |
| IA (tailoring + scoring + parsing) | Google Gemini (`gemini-3.1-flash-lite-preview`) via proxy Express |
| Enriquecimiento de ofertas | Tavily API + Gemini (via proxy) |
| Búsqueda de ofertas | Adzuna API (client-side) |
| Exportación | jsPDF (PDF) + docx (DOCX) — completamente client-side |
| i18n | react-i18next (ES / EN) |
| Tests unitarios | Vitest + Testing Library |
| Tests E2E | Playwright |
| Calidad de código | ESLint + Prettier + Husky (pre-commit / pre-push) |

---

## Instalación y ejecución

### Requisitos previos

- Node.js >= 18
- Docker Desktop (para Supabase local)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Cuenta en [Adzuna Developer](https://developer.adzuna.com) — obtener `App ID` y `App Key`
- Clave de API de [Google AI Studio](https://aistudio.google.com) — para Gemini
- Clave de API de [Tavily](https://tavily.com) — para el enriquecimiento de ofertas

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd JobTaylor
npm install
```

### 2. Variables de entorno

Crear un fichero `.env.local` en la raíz del proyecto (nunca subir a git):

```env
# Supabase local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key que muestra supabase start>
VITE_USE_SUPABASE=true

# Adzuna (búsqueda de ofertas — client-side)
VITE_ADZUNA_APP_ID=<tu app id>
VITE_ADZUNA_APP_KEY=<tu app key>

# URL del proxy local (no cambiar si usas la configuración por defecto)
VITE_PROXY_URL=http://localhost:3001

# Gemini (solo proxy — nunca expuesto al frontend)
GEMINI_API_KEY=<tu clave de API>
GEMINI_MODEL=gemini-3.1-flash-lite-preview

# Tavily — enriquecimiento de ofertas (solo proxy)
TAVILY_API_KEY=<tu clave de API>

# Origen CORS permitido (por defecto el servidor de desarrollo de Vite)
ALLOWED_ORIGIN=http://localhost:5173
```

> Las claves de Gemini y Tavily solo se leen en el proceso Node del proxy, nunca llegan al bundle del navegador.

### 3. Arrancar Supabase local

```bash
npx supabase start
# Anota la "anon key" que aparece y ponla en VITE_SUPABASE_ANON_KEY del .env.local
```

Si es la primera vez o tras un `supabase stop`, aplica las migraciones:

```bash
npx supabase db reset
```

### 4. Arrancar el proxy de IA

El proxy es un servidor Express que actúa de intermediario entre el frontend y los servicios de IA (Gemini y Tavily), manteniendo las claves de API fuera del navegador:

```bash
npm run proxy
# Arranca en http://localhost:3001
```

El proxy expone los siguientes endpoints:

| Endpoint | Función |
|---|---|
| `POST /tailor` | Genera el CV adaptado con guardrails (Gemini) |
| `POST /enrich` | Enriquece una oferta a partir de su URL (Tavily + Gemini) |
| `POST /score` | Calcula la compatibilidad CV ↔ oferta, 0-100 (Gemini) |
| `POST /parse-cv` | Analiza texto de CV e infiere estructura JSON (Gemini) |
| `GET  /health` | Comprueba que el proxy está activo |

### 5. Arrancar la aplicación

```bash
npm run dev
# Abre http://localhost:5173
```

---

## Estructura del proyecto

```
JobTaylor/
├── src/
│   ├── app/                  # Composition root, router, contextos globales (AppDepsContext)
│   ├── features/             # Feature slices — cada uno con domain/ + application/ + ui/
│   │   ├── auth/             # Login, registro, validación OWASP
│   │   ├── cv-base/          # CV Base CRUD (editor, upload PDF/DOCX, vista previa)
│   │   ├── job-postings/     # Búsqueda de ofertas (Adzuna), filtros, infinite scroll
│   │   ├── tailoring/        # Generación de CV adaptado con IA
│   │   ├── history/          # Historial de CVs generados
│   │   └── settings/         # Preferencias del usuario
│   ├── infra/                # Implementaciones de puertos (adaptadores)
│   │   ├── ai/               # GeminiAiClient (producción), FakeAiClient (tests)
│   │   ├── enrichment/       # GeminiEnrichmentAdapter (producción), FakeEnrichmentAdapter (tests)
│   │   ├── scoring/          # GeminiScoringAdapter (producción), FakeScoringAdapter (tests)
│   │   ├── cv-parser/        # Importación de CV desde texto / PDF / DOCX
│   │   ├── export/           # Exportación a PDF y DOCX
│   │   ├── job-feed/         # Cliente de la API de Adzuna
│   │   ├── memory/           # Repositorios in-memory (tests)
│   │   └── supabase/         # Repositorios Supabase (producción)
│   └── shared/               # Componentes y utilidades transversales, i18n
├── proxy/
│   └── server.cjs            # Proxy Express (Gemini + Tavily)
├── supabase/
│   └── migrations/           # Migraciones SQL con Row Level Security
├── e2e/                      # Tests E2E con Playwright
└── docs/                     # ADRs y documentación adicional
```

La arquitectura sigue **Clean Architecture con Ports & Adapters**:

```
UI → application (casos de uso) → domain (lógica pura)
                                         ↑
infra implementa los puertos       (sin dependencias externas)
```

La capa de dominio no tiene dependencias de React, Supabase ni ninguna librería externa. La composición de dependencias se realiza en `src/app/AppDepsContext.tsx`. El desarrollo de dominio y aplicación sigue **TDD**: cada comportamiento se especifica primero como test antes de implementarse.

---

## Funcionalidades principales

### Autenticación

- Registro e inicio de sesión con email y contraseña via Supabase Auth.
- Validación de contraseña con criterios OWASP: mínimo 12 caracteres, mayúsculas, minúsculas, números y caracteres especiales.
- Barra de fortaleza de contraseña en tiempo real con checklist de requisitos.
- Rate limiting en frontend: 3 intentos fallidos generan un bloqueo de 60 segundos.
- Sin enumeración de usuarios: los mensajes de error nunca revelan si un email existe.
- Row Level Security (RLS): cada usuario solo accede a sus propios datos.

### CV Base

- Editor estructurado: información personal, resumen, experiencia, educación, habilidades, idiomas y enlaces.
- Importación desde PDF, DOCX o texto plano: el proxy analiza el contenido con Gemini e infiere la estructura JSON.
- Vista previa del CV renderizada en tiempo real.
- Autoguardado en Supabase.

### Búsqueda de ofertas

- Búsqueda real de ofertas de empleo via la **API de Adzuna**.
- Filtros por palabras clave, modalidad (remoto) y ubicación.
- El filtro de ubicación es un **combobox con texto libre**: el usuario puede escribir cualquier ciudad (incluyendo ciudades que no aparezcan en los resultados iniciales), con sugerencias basadas en los resultados cargados.
- Infinite scroll con paginación automática.
- Puntuación de compatibilidad CV ↔ oferta calculada por Gemini al seleccionar cada oferta.
- Enriquecimiento de la oferta: Tavily extrae el contenido completo de la URL de la oferta y Gemini lo estructura (requisitos imprescindibles, deseables, stack tecnológico, información sobre la empresa).

### Tailoring con IA

- La IA recibe el CV Base en JSON y la descripción de la oferta (original y/o enriquecida).
- Reescribe y reordena el contenido para destacar lo más relevante para esa oferta.
- **Guardrails estrictos**: nunca inventa experiencia, empleadores, títulos, fechas, títulos académicos ni certificaciones.
- Si la oferta requiere algo que el candidato no tiene, la IA lo indica como brecha (*gap*) en lugar de fabricarlo.
- Cola de generación global: se pueden encolar múltiples tailorings en paralelo mientras se navega por la aplicación.
- Nivel de fidelidad configurable (slider 0-100%): controla cuánta libertad creativa tiene la IA.

### Exportación

- Descarga del CV adaptado en **PDF**, **DOCX** o **Markdown**.
- Generación completamente client-side: sin servidor adicional, sin subida de datos.
- Tres plantillas visuales disponibles: modern, classic y minimal.
- Soporte para foto de perfil opcional en el CV exportado.

### Historial

- Lista de todas las ofertas guardadas y CVs generados, con su estado: `saved`, `generating`, `queued`, `generated`, `exported`.
- Filtros por estado, región y búsqueda de texto libre.
- Los títulos de oferta son enlaces directos a la oferta original.
- Eliminación individual con diálogo de confirmación.

### Ajustes

- **Idioma de salida**: Español o Inglés (afecta a la interfaz y al contenido generado por la IA).
- **Plantilla de CV**: selección visual entre modern, classic y minimal.
- **Nivel de fidelidad**: slider que controla la strictness del tailoring.
- **Formato de exportación por defecto**: PDF, DOCX o Markdown.
- **Foto de perfil**: subida y recorte de imagen opcional para incluir en el CV exportado.

### Internacionalización

- Interfaz completamente disponible en **Español** e **Inglés**.
- El cambio de idioma en Settings actualiza la UI al instante sin recargar la página.

---

## Comandos disponibles

```bash
npm run dev          # Arranca el servidor de desarrollo (Vite) en http://localhost:5173
npm run proxy        # Arranca el proxy Express de IA en http://localhost:3001
npm run build        # Build de producción (tsc + vite build)
npm run preview      # Preview del build de producción

npm run test         # Tests unitarios (Vitest)
npm run test:watch   # Tests unitarios en modo watch
npm run test:e2e     # Tests E2E (Playwright)

npm run lint         # ESLint
npm run typecheck    # TypeScript sin emitir (tsc --noEmit)
npm run format       # Prettier

npm run quality      # lint + typecheck + test (gate de calidad — ejecutado en pre-commit)
npm run verify       # quality + test:e2e + build (gate completo — ejecutado en pre-push)
```

---

## Tests

El proyecto se ha desarrollado siguiendo **TDD (Test-Driven Development)** en las capas de dominio y aplicación: primero se escribe el test que describe el comportamiento esperado (rojo), luego el código mínimo para hacerlo pasar (verde) y finalmente se refactoriza sin cambiar el comportamiento (refactor). Los tests de UI se cubren mediante E2E con Playwright.

### Unitarios (Vitest)

- Cubren la lógica de dominio y los casos de uso de application.
- Usan repositorios in-memory y clientes de IA falsos (`FakeAiClient`, `FakeScoringAdapter`, `FakeEnrichmentAdapter`) — sin red, sin Supabase, sin Gemini.
- Se ejecutan con `npm run test`.

### E2E (Playwright)

- Cubren el flujo completo con autenticación real contra Supabase local.
- Incluyen: registro, login, edición de CV, búsqueda de ofertas, guardado, tailoring y exportación.
- Se ejecutan con `npm run test:e2e`.

### Calidad automatizada

- **Husky pre-commit**: ejecuta `npm run quality` (lint + typecheck + tests unitarios) antes de cada commit.
- **Husky pre-push**: ejecuta `npm run verify` (quality + E2E + build) antes de cada push.

---

## Solución de problemas frecuentes

### La app carga en blanco o no conecta a Supabase

Los contenedores Docker de Supabase pueden perder el mapeo de puertos al host tras reinicios del sistema o hibernaciones. Docker los muestra como `running` pero no son accesibles desde `localhost`.

**Solución:**

```bash
npx supabase stop
npx supabase start
```

Si falla con "ports are not available" (Windows), abre PowerShell como Administrador y ejecuta:

```powershell
net stop winnat
# Luego en tu terminal normal:
# npx supabase start
# Y de vuelta en la terminal de Administrador:
net start winnat
```

### Errores al guardar tras reiniciar Supabase

Si las migraciones no se han aplicado correctamente, algunas tablas pueden estar incompletas. Solución:

```bash
npx supabase db reset
```

### El proxy devuelve error 503

Asegúrate de que `GEMINI_API_KEY` y `TAVILY_API_KEY` están configuradas en `.env.local` y que has arrancado el proxy con `npm run proxy` (que carga automáticamente el fichero `.env.local`).
