# JobTaylor

**JobTaylor** es una aplicación web que ayuda a los candidatos a adaptar su CV a ofertas de empleo concretas usando inteligencia artificial, con guardrails estrictos que garantizan que el CV resultante nunca inventa experiencia ni datos falsos.

---

## Descripcion general

El flujo principal de la aplicación es:

1. El usuario crea su **CV Base** con su experiencia real (texto, PDF o DOCX).
2. Busca **ofertas de empleo reales** via la API de Adzuna con filtros personalizados.
3. Selecciona una oferta y lanza el **proceso de tailoring**: la IA reescribe y reordena el CV Base para destacar lo más relevante para esa oferta, sin inventar nada.
4. Descarga el CV adaptado en **PDF o DOCX**.
5. Consulta el **historial** de CVs generados, con filtros por estado, región y búsqueda de texto.

---

## Stack tecnologico

| Capa | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS v4 + shadcn/ui + Radix UI |
| Routing | React Router v7 |
| Auth + DB | Supabase (local: Docker via Supabase CLI) |
| IA local | Ollama (`qwen2.5:0.5b`) via proxy Express |
| Busqueda de ofertas | Adzuna API |
| Export | jsPDF (PDF) + docx (DOCX) — client-side |
| i18n | react-i18next (ES / EN) |
| Tests unitarios | Vitest + Testing Library |
| Tests E2E | Playwright |
| Calidad | ESLint + Prettier + Husky (pre-commit/pre-push) |

---

## Instalacion y ejecucion

### Requisitos previos

- Node.js >= 18
- Docker Desktop (para Supabase local)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Ollama](https://ollama.com) con el modelo descargado: `ollama pull qwen2.5:0.5b`
- Cuenta gratuita en [Adzuna Developer](https://developer.adzuna.com) para obtener `App ID` y `App Key`

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd JobTaylor
npm install
```

### 2. Variables de entorno

Crear un fichero `.env.local` en la raiz del proyecto (nunca subir a git):

```env
# Supabase local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon key que muestra supabase start>
VITE_USE_SUPABASE=true

# Adzuna (busqueda de ofertas)
VITE_ADZUNA_APP_ID=<tu app id>
VITE_ADZUNA_APP_KEY=<tu app key>

# Proveedor de IA: fake | ollama
VITE_AI_PROVIDER=ollama

# Proxy Ollama (no cambiar si usas la configuracion por defecto)
VITE_PROXY_URL=http://localhost:3001
```

### 3. Arrancar Supabase local

```bash
npx supabase start
# Anota la "anon key" que aparece y ponla en .env.local
```

### 4. Arrancar el proxy de Ollama

El proxy es un servidor Express que actua de intermediario entre el frontend y Ollama, evitando problemas de CORS:

```bash
npm run proxy
# Arranca en http://localhost:3001
```

### 5. Arrancar la aplicacion

```bash
npm run dev
# Abre http://localhost:5173
```

---

## Estructura del proyecto

```
JobTaylor/
├── src/
│   ├── app/                  # Composition root, router, contextos globales
│   ├── features/             # Feature slices (dominio + casos de uso + UI por feature)
│   │   ├── auth/             # Login, registro, validacion OWASP
│   │   ├── cv-base/          # CV Base CRUD (upload PDF/DOCX, edicion)
│   │   ├── job-postings/     # Busqueda de ofertas (Adzuna), infinite scroll
│   │   ├── tailoring/        # Generacion de CV adaptado con IA
│   │   ├── history/          # Historial de CVs generados
│   │   └── settings/         # Preferencias del usuario (idioma, tema, IA)
│   ├── infra/                # Implementaciones de puertos (adaptadores)
│   │   ├── ai/               # OllamaAiClient, FakeAiClient
│   │   ├── export/           # Exportacion PDF y DOCX
│   │   ├── job-feed/         # Adzuna API client
│   │   ├── memory/           # Repositorios in-memory (tests)
│   │   └── supabase/         # Repositorios Supabase (produccion)
│   └── shared/               # Componentes y utilidades transversales
├── proxy/
│   └── server.cjs            # Proxy Express para Ollama (evita CORS)
├── supabase/
│   └── migrations/           # Migraciones SQL con RLS
├── e2e/                      # Tests E2E con Playwright
└── docs/                     # Documentacion adicional y ADRs
```

La arquitectura sigue **Clean Architecture con Ports & Adapters**:

```
UI -> application (casos de uso) -> domain (logica pura)
                                         ^
infra implementa los puertos        (sin dependencias externas)
```

Cada feature sigue la estructura `domain/ | application/ | ui/`. La capa de dominio no tiene dependencias de React, Supabase ni ninguna libreria externa.

---

## Funcionalidades principales

### Autenticacion
- Registro e inicio de sesion con email/password via Supabase Auth
- Validacion de contrasena siguiendo criterios OWASP (minimo 12 caracteres, mayusculas, minusculas, numeros y caracteres especiales)
- Barra de fortaleza de contrasena en tiempo real
- Rate limiting frontend (3 intentos fallidos → bloqueo de 60 segundos)
- Row Level Security (RLS): cada usuario solo accede a sus propios datos
- Modo claro/oscuro con persistencia

### CV Base
- Creacion y edicion del CV estructurado (experiencia, educacion, skills, idiomas, enlaces)
- Importacion desde PDF o DOCX
- El CV se almacena como JSON estructurado, no como fichero

### Busqueda de ofertas
- Busqueda real de ofertas via **Adzuna API**
- Filtros por palabras clave, ubicacion y categoria
- Infinite scroll con paginacion
- Cada oferta tiene boton directo para lanzar el tailoring

### Tailoring con IA
- La IA recibe el CV Base en JSON y la descripcion de la oferta
- Reescribe y reordena el contenido para destacar lo relevante
- **Guardrails estrictos**: nunca inventa experiencia, titulos, fechas ni certificaciones
- Si la oferta requiere algo que el candidato no tiene, lo indica como gap, no lo fabrica
- Cola de generacion global: se pueden encolar multiples tailorings
- Soporte para **Ollama** (local, sin coste) y **FakeAiClient** (tests)

### Exportacion
- Descarga del CV adaptado en **PDF** o **DOCX**
- Generacion completamente client-side (sin servidor)

### Historial
- Lista de todos los CVs generados con su estado (`saved`, `generating`, `queued`, `exported`)
- Filtros por estado, region y busqueda de texto libre
- Los titulos de oferta son enlaces directos a la oferta original
- Eliminacion individual con confirmacion

### Internacionalizacion
- Interfaz disponible en **Espanol** e **Ingles**
- Selector de idioma en Settings; el CV generado respeta el idioma configurado

---

## Comandos disponibles

```bash
npm run dev          # Arranca el servidor de desarrollo (Vite)
npm run proxy        # Arranca el proxy Express para Ollama
npm run build        # Build de produccion (tsc + vite build)
npm run preview      # Preview del build de produccion

npm run test         # Tests unitarios (Vitest)
npm run test:watch   # Tests unitarios en modo watch
npm run test:e2e     # Tests E2E (Playwright)

npm run lint         # ESLint
npm run typecheck    # TypeScript sin emitir (tsc --noEmit)
npm run format       # Prettier

npm run quality      # lint + typecheck + test (gate de calidad)
npm run verify       # quality + test:e2e + build (gate completo)
```

---

## Tests

### Unitarios (Vitest)
- Cubren logica de dominio y casos de uso
- Usan repositorios in-memory y `FakeAiClient` — sin red, sin Supabase
- Se ejecutan con `npm run test`

### E2E (Playwright)
- Cubren el flujo completo con autenticacion real contra Supabase local
- Incluyen: registro, login, edicion de CV, busqueda de ofertas, tailoring y exportacion
- Se ejecutan con `npm run test:e2e`

### Calidad automatizada
- **Husky pre-commit**: ejecuta `npm run quality` antes de cada commit
- **Husky pre-push**: ejecuta `npm run verify` antes de cada push

---

## Despliegue

> Pendiente — ver seccion de roadmap.

El despliegue previsto es **Vercel** (frontend) + **Supabase Cloud** (DB/Auth).

---

## Roadmap

- [ ] Migracion a Supabase Cloud
- [ ] Deploy en Vercel
- [ ] Proveedor de IA cloud (Gemini / OpenAI) como alternativa a Ollama
- [ ] "Olvide mi contrasena" / password reset
- [ ] OAuth / Google login
- [ ] Puntuacion de compatibilidad CV-oferta antes de tailorear
