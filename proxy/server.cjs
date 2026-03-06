/**
 * JobTaylor Local Proxy Server
 *
 * Corre en localhost:3001. Hace cuatro cosas:
 *   POST /enrich   → enriquece una oferta a partir de su URL (Tavily + Gemini)
 *   POST /score    → compatibilidad CV ↔ oferta (Gemini, 0-100)
 *   POST /tailor   → genera CV adaptado con guardrails (Gemini)
 *   POST /parse-cv → parsea texto de CV (heurística + Gemini para campos narrativos)
 *   GET  /health   → comprueba que el proxy está activo
 *
 * Uso: node proxy/server.js   (o npm run proxy)
 */

const express = require('express')
const { parse } = require('node-html-parser')

const PORT = 3001
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const TAVILY_API_KEY = process.env.TAVILY_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview'
// Allowed CORS origin — defaults to Vite dev server; override via ALLOWED_ORIGIN env var
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
// Límite para Gemini — ventana de contexto de 1M tokens, podemos enviar mucho más
const MAX_TEXT_CHARS_GEMINI = 50000

const app = express()
app.use(express.json())

// CORS: permite peticiones solo desde el origen configurado (ALLOWED_ORIGIN env var)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ---------------------------------------------------------------------------
// GET /health — comprueba proxy
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  res.json({ proxy: 'ok', gemini: GEMINI_API_KEY ? 'configured' : 'not configured' })
})

// ---------------------------------------------------------------------------
// POST /enrich  — body: { url: string, language?: 'EN' | 'ES' }
// ---------------------------------------------------------------------------
app.post('/enrich', async (req, res) => {
  const { url, language } = req.body
  // language: 'EN' | 'ES' — controls the output language of the enrichment. Default ES.
  const outputLanguage = language === 'EN' ? 'EN' : 'ES'
  console.log(`[enrich] language=${outputLanguage} url=${url}`)
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  if (!TAVILY_API_KEY) {
    console.error('[enrich] TAVILY_API_KEY is not set — restart proxy with --env-file=.env.local')
    return res.status(503).json({ error: 'TAVILY_API_KEY not configured in proxy environment' })
  }
  if (!GEMINI_API_KEY) {
    console.error('[enrich] GEMINI_API_KEY is not set — restart proxy with --env-file=.env.local')
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured in proxy environment' })
  }

  // Adzuna redirect URLs (/land/ad/{id}?...) return HTTP 403 to Tavily.
  // Convert them to the public details page (/details/{id}) which Tavily can fetch.
  let fetchUrl = url
  const adzunaRedirectMatch = url.match(/adzuna\.[a-z.]+\/land\/ad\/(\d+)/)
  if (adzunaRedirectMatch) {
    const jobId = adzunaRedirectMatch[1]
    const adzunaDomain = url.match(/https?:\/\/(www\.adzuna\.[a-z.]+)\//)?.[1] ?? 'www.adzuna.es'
    fetchUrl = `https://${adzunaDomain}/details/${jobId}`
    console.log(`[enrich] Adzuna redirect detected — rewriting to details page: ${fetchUrl}`)
  }

  // 1. Usar Tavily Extract para obtener el contenido limpio de la página
  let pageContent
  try {
    console.log(`[enrich] calling Tavily Extract for: ${fetchUrl}`)
    const tavilyRes = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        urls: [fetchUrl],
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!tavilyRes.ok) {
      const errBody = await tavilyRes.text()
      throw new Error(`Tavily HTTP ${tavilyRes.status}: ${errBody}`)
    }
    const tavilyData = await tavilyRes.json()
    // Tavily Extract devuelve { results: [{ url, raw_content, ... }], failed_results: [...] }
    const result = tavilyData.results?.[0]
    if (!result || !result.raw_content) {
      const failReason = tavilyData.failed_results?.[0]?.error ?? 'no content returned'
      throw new Error(`Tavily returned no content for this URL: ${failReason}`)
    }
    pageContent = result.raw_content.slice(0, MAX_TEXT_CHARS_GEMINI)
    console.log(`[enrich] Tavily OK — ${pageContent.length} chars extracted`)
  } catch (err) {
    console.error('[enrich] Tavily failed:', err)
    return res.status(502).json({ error: `Tavily extract failed: ${err}` })
  }

  // 2. Llamar a Gemini para estructurar el contenido
  const outputLang = outputLanguage === 'ES' ? 'Spanish' : 'English'
  const geminiPrompt = `You are a senior talent analyst and expert technical writer. Your task is to deeply analyse a job posting and produce a rich, professionally-written structured summary that a candidate can use to understand the role in full detail and tailor their CV accordingly.

STRICT RULES — follow every one without exception:
1. Extract ONLY information present in the job posting. Never invent, assume, or hallucinate anything.
2. Write ALL text fields ("description", "requirements", "niceToHave", "techStack", "aboutCompany") in clear, professional ${outputLang}. This is mandatory regardless of the language of the original job posting.
3. The "description" field must be a multi-paragraph narrative (minimum 5 paragraphs). Cover: the purpose of the role, the team structure and how this position fits in, the day-to-day responsibilities, the expected impact on the product or business, working conditions (remote/hybrid/on-site, salary range, benefits, perks) if mentioned, and any other context that would help a candidate decide whether to apply.
4. "requirements" must only list things the posting explicitly marks as mandatory, essential, required, or minimum (e.g. years of experience, specific degrees, must-have technologies). Be concrete and specific — write "5+ years of experience with Python" not "Python experience".
5. "niceToHave" must only list things the posting marks as valued, desired, a plus, or nice to have. Same specificity rule applies.
6. "techStack" must be exhaustive: list every technology, programming language, framework, library, tool, cloud platform, database, methodology (Agile, Scrum, Kanban, SAFe…), soft skill explicitly valued (leadership, communication, mentoring…), spoken language requirements, certification names, etc. Include EVERYTHING relevant to a technical profile.
7. "aboutCompany" must synthesise all available information about the employer: industry sector, product or service, size, stage (startup/scaleup/enterprise), mission or vision, culture, notable clients or projects, office locations. If insufficient info is present, return null.
8. Return ONLY valid JSON — no markdown, no code fences, no explanatory text outside the JSON object.

Output JSON schema (use exactly these keys):
{
    "description": "5+ paragraph narrative in ${outputLang} covering role purpose, team context, day-to-day responsibilities, expected impact, and any working conditions or benefits mentioned.",
  "requirements": [
    "Concrete mandatory requirement — include specific numbers/versions/years where stated",
    "..."
  ],
  "niceToHave": [
    "Concrete valued/bonus requirement — include specific numbers/versions/years where stated",
    "..."
  ],
  "techStack": [
    "Every technology, tool, methodology, or key skill mentioned — be exhaustive",
    "..."
  ],
  "aboutCompany": "Rich paragraph about the company. Null if insufficient information."
}

Job posting content to analyse:
---
${pageContent}
---

Respond with valid JSON only.`

  let enriched
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    )
    if (!geminiRes.ok) {
      const errBody = await geminiRes.text()
      throw new Error(`Gemini HTTP ${geminiRes.status}: ${errBody}`)
    }
    const geminiData = await geminiRes.json()
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!raw) throw new Error('Gemini returned empty response')
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    enriched = JSON.parse(cleaned)
    console.log('[enrich] Gemini OK — enrichment complete')
  } catch (err) {
    console.error('[enrich] Gemini failed:', err)
    return res.status(503).json({ error: `Gemini enrichment failed: ${err}` })
  }

  return res.json(enriched)
})

// ---------------------------------------------------------------------------
// POST /score — body: { cvPreview: string, jobDescription: string }
// Devuelve { score: number } — compatibilidad 0-100 entre el CV y la oferta.
//
// Retro-compatibilidad: si llega el cuerpo antiguo { cv, jobTitle, jobDescription }
// (sin cvPreview) se construye cvPreview a partir del objeto cv.
// ---------------------------------------------------------------------------
app.post('/score', async (req, res) => {
  const { cvPreview: cvPreviewRaw, jobDescription, cv, jobTitle } = req.body

  // Retro-compatibilidad con el formato antiguo { cv, jobTitle, jobDescription }
  let cvPreview = cvPreviewRaw
  if (!cvPreview && cv) {
    const skillNames = (cv.skills || []).map(s => s.name).join(', ')
    const expSummary = (cv.experience || [])
      .map(e => `${e.title} en ${e.company} (${e.startDate}–${e.endDate || 'presente'})`)
      .join('; ')
    cvPreview = [
      cv.summary ? `Resumen: ${cv.summary}` : '',
      skillNames ? `Skills: ${skillNames}` : '',
      expSummary ? `Experiencia: ${expSummary}` : '',
      jobTitle ? `Puesto al que aplica: ${jobTitle}` : '',
    ].filter(Boolean).join('\n')
  }

  if (!cvPreview || !jobDescription) {
    return res.status(400).json({ error: 'cvPreview y jobDescription son obligatorios' })
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured in proxy environment' })
  }

  const prompt = `You are a recruitment expert. Evaluate the compatibility between a candidate and a job posting.

CANDIDATE CV:
${cvPreview}

JOB DESCRIPTION:
${jobDescription.slice(0, 4000)}

Return ONLY a single integer from 0 to 100 representing the compatibility percentage. No explanation, no text, no punctuation — just the number.
Example of a valid response: 73`

  try {
    console.log(`[score] Gemini scoring — cv ${cvPreview.length} chars, job ${jobDescription.length} chars`)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 32 },
        }),
        signal: AbortSignal.timeout(60000),
      }
    )
    if (!geminiRes.ok) {
      const errBody = await geminiRes.text()
      throw new Error(`Gemini HTTP ${geminiRes.status}: ${errBody}`)
    }
    const geminiData = await geminiRes.json()
    const candidate = geminiData.candidates?.[0]
    const finishReason = candidate?.finishReason ?? 'UNKNOWN'
    const raw = (candidate?.content?.parts?.[0]?.text ?? '').trim()
    console.log(`[score] Gemini raw="${raw}" finishReason=${finishReason}`)
    // Strip any non-digit chars (e.g. trailing newlines, quotes, "%" sign)
    const digits = raw.replace(/[^0-9]/g, '')
    const score = digits.length > 0 ? parseInt(digits, 10) : NaN
    if (isNaN(score)) {
      // Log full Gemini response to help diagnose recurring empty responses
      console.error('[score] Score not parseable. Full Gemini response:', JSON.stringify(geminiData))
      throw new Error(`Score no parseable: "${raw}" (finishReason=${finishReason})`)
    }
    const clamped = Math.min(100, Math.max(0, score))
    console.log(`[score] Gemini score=${clamped}`)
    return res.json({ score: clamped })
  } catch (err) {
    console.error('[score] Gemini failed:', err)
    return res.status(503).json({ error: `Error al calcular score con Gemini: ${err}` })
  }
})

// ---------------------------------------------------------------------------
// POST /tailor — body: { cv: BaseCv, jobTitle, jobDescription, enrichedDescription, strictness, language }
// Genera un CV adaptado a la oferta respetando los guardrails
// ---------------------------------------------------------------------------
app.post('/tailor', async (req, res) => {
  const { cv, jobTitle, jobDescription, enrichedDescription, strictness = 70, language = 'ES' } = req.body
  if (!cv || !jobTitle) {
    return res.status(400).json({ error: 'cv y jobTitle son obligatorios' })
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured in proxy environment' })
  }

  // Instrucción de idioma de salida
  const languageInstruction = language === 'EN'
    ? 'Write the entire tailored CV in English. All fields (summary, job descriptions, bullet points, skills, etc.) must be in English.'
    : 'Escribe el CV adaptado en español. Todos los campos (resumen, descripciones de trabajo, puntos, habilidades, etc.) deben estar en español.'

  // Instrucción de creatividad basada en strictness (0=creativo, 100=estricto)
  const creativityInstruction = strictness >= 80
    ? 'Sé MUY ESTRICTO: solo reordena y resalta lo que ya existe en el CV. No reformules frases de manera sustancial. Copia literalmente las descripciones de experiencia si es posible.'
    : strictness >= 50
    ? 'Sé EQUILIBRADO: puedes reformular frases para que encajen mejor con la oferta, pero sin cambiar el significado ni inventar nada.'
    : 'Sé CREATIVO: reformula y enfatiza las experiencias del CV de la manera que mejor encaje con la oferta. Puedes usar sinónimos y reordenar libremente, pero NUNCA inventes experiencia, empresas, fechas ni tecnologías que no estén en el CV original.'

  const cvJson = JSON.stringify(cv, null, 2)
  const jobContext = enrichedDescription || jobDescription || jobTitle

  const prompt = `Eres un experto en redacción de CVs. Tu tarea es adaptar el CV de un candidato a una oferta de trabajo concreta.

GUARDRAILS OBLIGATORIOS (nunca los ignores):
- NUNCA inventes experiencia, empresas, fechas, titulaciones ni tecnologías que no estén en el CV original.
- Si algo no está en el CV, no lo añadas.
- Si la oferta pide algo que el candidato no tiene, inclúyelo en "gaps" pero NO lo añadas al CV adaptado.
- Preserva SIEMPRE los arrays aunque estén vacíos: "experience", "education", "skills", "languages", "links" deben aparecer en el JSON de salida aunque no haya cambios.

NIVEL DE ADAPTACIÓN: ${creativityInstruction}

IDIOMA DE SALIDA: ${languageInstruction}

CV ORIGINAL (JSON):
${cvJson}

OFERTA DE TRABAJO:
Título: ${jobTitle}
${jobContext.slice(0, 3000)}

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta. El campo "tailoredCv" debe contener TODOS los campos del CV original con los mismos nombres de clave:
{
  "tailoredCv": {
    "personalInfo": { "fullName": "...", "email": "...", "phone": "...", "location": "...", "title": "..." },
    "summary": "...",
    "experience": [ { "id": "...", "title": "...", "company": "...", "location": "...", "startDate": "...", "endDate": "...", "description": [], "technologies": [] } ],
    "education": [ { "id": "...", "degree": "...", "institution": "...", "location": "...", "startDate": "...", "endDate": "...", "description": null } ],
    "skills": [ { "name": "...", "level": null, "category": null } ],
    "languages": [ { "name": "...", "level": "..." } ],
    "links": [ { "label": "...", "url": "..." } ]
  },
  "gaps": ["habilidad o requisito que pide la oferta pero no está en el CV"],
  "suggestions": ["sugerencia para mejorar el perfil sin inventar nada"]
}

Solo el JSON, sin texto adicional.`

  try {
    console.log(`[tailor] Gemini — strictness=${strictness} language=${language} cv=${cvJson.length}chars job=${jobContext.length}chars`)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
        signal: AbortSignal.timeout(60000),
      }
    )
    if (!geminiRes.ok) {
      const errBody = await geminiRes.text()
      throw new Error(`Gemini HTTP ${geminiRes.status}: ${errBody}`)
    }
    const geminiData = await geminiRes.json()
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!raw) throw new Error('Gemini returned empty response')
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    const result = JSON.parse(cleaned)
    console.log('[tailor] Gemini OK')
    return res.json(result)
  } catch (err) {
    console.error('[tailor] Gemini failed:', err)
    return res.status(503).json({ error: `Error al adaptar CV con Gemini: ${err}` })
  }
})

// ---------------------------------------------------------------------------
// Parser heurístico completo de CV (no depende del modelo para campos planos)
// Gemini solo se usa para el summary (campo narrativo libre) y el title
// cuando la heurística no los puede extraer con seguridad.
// ---------------------------------------------------------------------------

const SECTION_HEADINGS_RE = /^(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|EXPERIENCIA|EXPERIENCIA LABORAL|TRAYECTORIA|EDUCATION|ACADEMIC|FORMACI[ÓO]N|ESTUDIOS|EDUCACI[ÓO]N|SKILLS?|TECNOLOG[ÍI]AS?|COMPETENCIAS?|HABILIDADES?|LANGUAGES?|IDIOMAS?|LINKS?|URLS?|PROFILE|SUMMARY|ABOUT|OBJECTIVE|RESUMEN|PERFIL|EXTRACTO|CERTIFICATIONS?|CERTIFICACIONES?|PROJECTS?|PROYECTOS?|PUBLICACIONES?|LOGROS?|ACHIEVEMENTS?)\s*$/i

/** Devuelve las líneas de texto de una sección dada (de su encabezado hasta el siguiente) */
function getSectionLines(lines, headingRe) {
  const start = lines.findIndex(l => headingRe.test(l.trim()))
  if (start === -1) return []
  const end = lines.findIndex((l, i) => i > start && SECTION_HEADINGS_RE.test(l.trim()))
  return end === -1 ? lines.slice(start + 1) : lines.slice(start + 1, end)
}

/** Extrae email */
function extractEmail(text) {
  const m = text.match(/[^\s@,;|<>]+@[^\s@,;|<>]+\.[a-zA-Z]{2,}/)
  return m ? m[0] : null
}

/** Extrae teléfono */
function extractPhone(text) {
  const m = text.match(/(\+?\d[\d\s\-().]{5,14}\d)/)
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

/** Extrae URLs clasificadas */
function extractLinks(text) {
  const urlRe = /https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+/g
  const urls = [...new Set(text.match(urlRe) ?? [])]
  return urls.map(url => {
    if (/linkedin/i.test(url)) return { label: 'LinkedIn', url }
    if (/github/i.test(url)) return { label: 'GitHub', url }
    if (/portfolio/i.test(url)) return { label: 'Portfolio', url }
    if (/twitter|x\.com/i.test(url)) return { label: 'Twitter', url }
    return { label: url.replace(/^https?:\/\//, '').split('/')[0], url }
  })
}

/** Extrae skills de la sección Skills */
function extractSkills(lines) {
  const sectionLines = getSectionLines(lines, /^(SKILLS?|TECNOLOG[ÍI]AS?|COMPETENCIAS?|TECHNICAL SKILLS?|HABILIDADES?)$/i)
  if (!sectionLines.length) return []
  const raw = sectionLines.join(' | ')
  return raw
    .split(/[,;\n•|]/)                           // NO partir por / ni – para respetar CI/CD, front-end, etc.
    .map(s => s.trim().replace(/^[-•*]\s*/, ''))
    .filter(s => s.length > 1 && s.length < 60 && !/^(skills?|tech(nologies)?|tools?|tecnolog[ií]as?|habilidades?)$/i.test(s))
    .map(name => ({ name, level: null, category: null }))
}

/** Extrae idiomas de la sección Languages */
function extractLanguages(lines) {
  const sectionLines = getSectionLines(lines, /^(LANGUAGES?|IDIOMAS?)$/i)
  if (!sectionLines.length) return []
  const raw = sectionLines.join(' | ')
  return raw
    .split(/[,;\n•|]/)
    .map(s => s.trim())
    .filter(s => s.length > 1)
    .map(s => {
      // Nivel entre paréntesis: "English (C1)" o al final "English C1" o con guión "English - C1"
      const levelRe = /\b([A-C][12]|Native|Nativo|Bilingüe|Bilingual|Fluent|Fluido|Basic|Básico|Elementary|Intermediate|Advanced)\b/i
      const levelM = s.match(levelRe)
      const level = levelM ? levelM[1] : null
      const name = s
        .replace(/\([^)]*\)/g, '')   // quita paréntesis y su contenido: "English (C1)" → "English"
        .replace(/\s*[-–:]\s*\S+/g, '') // quita "- C1", ": C1", "– Native"
        .replace(levelRe, '')         // quita el nivel si quedó suelto
        .replace(/[()[\]]/g, '')      // limpia paréntesis residuales
        .trim()
      return name.length > 1 ? { name, level } : null
    })
    .filter(Boolean)
}

/**
 * Parsea el rango de fechas de una línea tipo:
 *   "Mar 2018 – Jan 2019 | Valencia"
 *   "2018-03 – Present"
 *   "Sep 2013 – Jun 2017"
 * Devuelve { startDate, endDate, location }
 */
function parseDateLine(line) {
  // Separadores de fecha: –, -, to, hasta, /
  // Acepta también "Present", "Presente", "Actual", "Current", "en curso", "hoy"
  const dateRe = /([A-Za-z]{0,4}\.?\s*\d{4}|\d{4}[-/]\d{2}|\d{4})\s*(?:–|—|-|to|hasta)\s*([A-Za-z]{0,4}\.?\s*\d{4}|\d{4}[-/]\d{2}|Present|Presente|Actual|Current|En\s+curso|Hoy|\d{4})?/i
  const m = line.match(dateRe)
  let startDate = null, endDate = null, location = null

  if (m) {
    startDate = m[1]?.trim() || null
    endDate   = m[2]?.trim() || null
    // Si el rango termina pero no hay fecha de fin, comprobamos si la línea
    // contiene explícitamente "present/actual/hoy" sin haberlo capturado
    if (!endDate && /\b(present|presente|actual|current|en\s+curso|hoy)\b/i.test(line)) {
      endDate = 'Present'
    }
    // Lo que queda después del rango puede ser la ubicación (separado por | o ,)
    const afterDate = line.slice(m.index + m[0].length).replace(/^\s*[|,]\s*/, '').trim()
    if (afterDate && afterDate.length < 60 && !/https?/.test(afterDate)) location = afterDate
  }
  return { startDate, endDate, location }
}

/**
 * Parsea bloques de experiencia laboral.
 * Detecta el patrón: "Título — Empresa" o "Título @ Empresa" o dos líneas separadas.
 */
function extractExperience(lines) {
  const sectionLines = getSectionLines(lines, /^(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|EXPERIENCIA|EXPERIENCIA LABORAL|TRAYECTORIA)$/i)
  if (!sectionLines.length) return []

  const entries = []
  let current = null

  // Separadores de título/empresa: —, –, @, " at ", " en "
  const titleCompanyRe = /^(.+?)(?:\s*[—–@]\s*|\s+(?:at|en)\s+)(.+)$/i
  // Línea de fecha: mes+año o año sólo, seguido de separador de rango
  const dateLineRe = /^(?:[A-Za-z]{2,4}\.?\s+)?\d{4}\s*(?:–|-|to|hasta)/i
  // Línea que solo tiene año (sin rango): para el caso "Sep 2013" suelto
  const yearLineRe = /^(?:[A-Za-z]{2,4}\.?\s+)?\d{4}$/i
  // Bullet: empieza con •, -, *, o número seguido de punto
  const bulletRe = /^[•\-*]|^\d+\.\s/
  // Tech line: "Tech:", "Technologies:", "Stack:", "Tools:"
  const techLineRe = /^(?:tech(?:nologies)?|stack|tools?|tecnolog[ií]as?)[\s:]+/i

  for (const line of sectionLines) {
    const l = line.trim()
    if (!l) continue

    // 1. Fecha tiene prioridad absoluta sobre título/empresa
    if (current && (dateLineRe.test(l) || yearLineRe.test(l))) {
      const { startDate, endDate, location } = parseDateLine(l)
      if (startDate) current.startDate = startDate
      if (endDate) current.endDate = endDate
      if (location && !current.location) current.location = location
      continue
    }

    const tcMatch = l.match(titleCompanyRe)

    if (tcMatch) {
      // Nueva entrada de experiencia
      if (current) entries.push(current)
      current = {
        title: tcMatch[1].trim(),
        company: tcMatch[2].trim(),
        location: null,
        startDate: null,
        endDate: null,
        description: [],
        technologies: [],
      }
    } else if (current && techLineRe.test(l)) {
      const techPart = l.replace(techLineRe, '')
      current.technologies = techPart.split(/[,;|]/).map(t => t.trim()).filter(Boolean)
    } else if (current && bulletRe.test(l)) {
      current.description.push(l.replace(/^[•\-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    } else if (current && l.length > 10) {
      // Línea de descripción sin bullet explícito
      current.description.push(l)
    }
  }
  if (current) entries.push(current)
  return entries
}

/**
 * Parsea bloques de educación.
 * Patrón: "Título — Institución" o dos líneas separadas.
 */
function extractEducation(lines) {
  const sectionLines = getSectionLines(lines, /^(EDUCATION|ACADEMIC|FORMACI[ÓO]N|ESTUDIOS|EDUCACI[ÓO]N)$/i)
  if (!sectionLines.length) return []

  const entries = []
  let current = null
  const titleInstRe = /^(.+?)(?:\s*[—–@]\s*|\s+(?:at|en)\s+)(.+)$/i
  const dateLineRe = /^(?:[A-Za-z]{2,4}\.?\s+)?\d{4}\s*(?:–|-|to|hasta)/i
  const yearLineRe = /^(?:[A-Za-z]{2,4}\.?\s+)?\d{4}$/i

  for (const line of sectionLines) {
    const l = line.trim()
    if (!l) continue

    // 1. Fecha tiene prioridad
    if (current && (dateLineRe.test(l) || yearLineRe.test(l))) {
      const { startDate, endDate, location } = parseDateLine(l)
      if (startDate) current.startDate = startDate
      if (endDate) current.endDate = endDate
      if (location && !current.location) current.location = location
      continue
    }

    const tcMatch = l.match(titleInstRe)
    if (tcMatch) {
      if (current) entries.push(current)
      current = {
        degree: tcMatch[1].trim(),
        institution: tcMatch[2].trim(),
        location: null,
        startDate: null,
        endDate: null,
        description: null,
      }
    } else if (current && l.length > 5 && !/^\d{4}/.test(l)) {
      current.description = current.description ? `${current.description}. ${l}` : l
    }
  }
  if (current) entries.push(current)
  return entries
}

/**
 * Extrae nombre y título de las primeras líneas del CV
 * (antes del primer encabezado de sección o línea con email/teléfono).
 */
function extractHeader(lines) {
  const metaRe = /[@+]|\d{3}|https?:\/\//
  const sectionRe = SECTION_HEADINGS_RE
  // Palabras clave que suelen aparecer en títulos profesionales
  const titleKeywordsRe = /\b(developer|engineer|designer|manager|analyst|consultant|architect|lead|senior|junior|fullstack|frontend|backend|devops|scientist|director|coordinator|specialist|product|project|data|cloud|mobile|web|software|qa|tester|scrum|agile|cto|ceo|coo)\b/i
  let fullName = null
  let title = null
  let location = null

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const l = lines[i].trim()
    if (!l || sectionRe.test(l) || metaRe.test(l)) continue
    // Limpieza de separadores de pipe/barra al inicio de línea
    const clean = l.replace(/^\s*[|/]\s*/, '').trim()
    if (!clean) continue

    if (!fullName && clean.length < 60 && !titleKeywordsRe.test(clean)) {
      fullName = clean
    } else if (!title && clean.length < 120 && (titleKeywordsRe.test(clean) || (!fullName && clean.length < 60))) {
      // Segunda línea limpia: si tiene palabras de título profesional, es el título
      title = clean
    } else if (!location && /\b(Madrid|Barcelona|Valencia|Remote|Remoto|Spain|España|Bilbao|Sevilla|Málaga|Zaragoza|Alicante|Murcia|Valladolid|London|Berlin|Paris|Amsterdam|Lisbon|Lisboa|Mexico|Buenos Aires|Bogotá|Lima|Santiago)\b/i.test(clean)) {
      location = clean
    }
  }

  // Intenta extraer location de la línea de contacto (email | phone | location)
  if (!location) {
    const contactLine = lines.slice(0, 8).find(l => /@/.test(l) || /\+?\d{6,}/.test(l))
    if (contactLine) {
      const parts = contactLine.split(/[|,]/).map(p => p.trim())
      for (const part of parts) {
        const digits = part.replace(/\s/g, '').replace(/[^\d]/g, '')
        const isPhone = digits.length >= 6
        const isEmail = /@/.test(part)
        const isUrl   = /https?:\/\//.test(part)
        if (!isPhone && !isEmail && !isUrl && part.length > 2 && part.length < 40) {
          location = part
          break
        }
      }
    }
  }

  return { fullName, title, location }
}

// ---------------------------------------------------------------------------
// POST /parse-cv — body: { text: string }
// Estrategia: Gemini analiza el CV completo y devuelve JSON estructurado.
// Fallback heurístico para email y teléfono si Gemini no los detecta.
// ---------------------------------------------------------------------------
app.post('/parse-cv', async (req, res) => {
  const { text } = req.body
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return res.status(400).json({ error: 'text es obligatorio y debe tener al menos 20 caracteres' })
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY no configurada en el proxy' })
  }

  const truncated = text.trim().slice(0, MAX_TEXT_CHARS_GEMINI)

  // ── Forced response schema — mirrors exactly the FormState used by the CV editor ──
  // This guarantees Gemini returns the exact field names and types the frontend needs,
  // with no ambiguity or post-processing required.
  const CV_EDITOR_SCHEMA = {
    type: 'OBJECT',
    properties: {
      fullName:  { type: 'STRING', description: 'Full name of the candidate' },
      email:     { type: 'STRING', description: 'Email address' },
      phone:     { type: 'STRING', description: 'Phone number including country code if present, or empty string' },
      location:  { type: 'STRING', description: 'City, country or region, or empty string' },
      title:     { type: 'STRING', description: 'Current professional title, e.g. "Senior Frontend Developer", or empty string' },
      summary:   { type: 'STRING', description: 'Professional summary paragraph, or empty string' },
      experience: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title:        { type: 'STRING', description: 'Job title' },
            company:      { type: 'STRING', description: 'Company name' },
            location:     { type: 'STRING', description: 'City / country, or empty string' },
            startDate:    { type: 'STRING', description: 'Start date in YYYY-MM format, e.g. "2021-03". If only year given use YYYY-01.' },
            endDate:      { type: 'STRING', description: 'End date in YYYY-MM format, or empty string if current position' },
            description:  { type: 'STRING', description: 'Bullet points joined with newline (\\n). Each bullet is one line. No leading dashes or bullets.' },
            technologies: { type: 'STRING', description: 'Comma-separated list of technologies, e.g. "React, TypeScript, Node.js". Empty string if none.' },
          },
          required: ['title', 'company', 'location', 'startDate', 'endDate', 'description', 'technologies'],
        },
      },
      education: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            degree:      { type: 'STRING', description: 'Degree or qualification name, e.g. "Bachelor\'s in Computer Science"' },
            institution: { type: 'STRING', description: 'University or school name' },
            location:    { type: 'STRING', description: 'City / country, or empty string' },
            startDate:   { type: 'STRING', description: 'Start date in YYYY-MM format, or empty string if unknown' },
            endDate:     { type: 'STRING', description: 'End date in YYYY-MM format, or empty string if ongoing' },
            description: { type: 'STRING', description: 'Additional notes, honours, GPA, or empty string' },
          },
          required: ['degree', 'institution', 'location', 'startDate', 'endDate', 'description'],
        },
      },
      skills: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name:     { type: 'STRING', description: 'Skill name, e.g. "TypeScript"' },
            level:    { type: 'STRING', description: 'One of: beginner, intermediate, advanced, expert. Empty string if not stated.' },
            category: { type: 'STRING', description: 'Category, e.g. "Frontend", "DevOps", "Soft Skills". Empty string if not stated.' },
          },
          required: ['name', 'level', 'category'],
        },
      },
      languages: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name:  { type: 'STRING', description: 'Language name, e.g. "English"' },
            level: { type: 'STRING', description: 'Proficiency level, e.g. "Native", "C1", "B2", "Fluent"' },
          },
          required: ['name', 'level'],
        },
      },
      links: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            label: { type: 'STRING', description: 'Link label, e.g. "LinkedIn", "GitHub", "Portfolio"' },
            url:   { type: 'STRING', description: 'Full URL including https://' },
          },
          required: ['label', 'url'],
        },
      },
    },
    required: ['fullName', 'email', 'phone', 'location', 'title', 'summary', 'experience', 'education', 'skills', 'languages', 'links'],
  }

  const prompt = `You are an expert CV parser. Extract ALL information from the CV text below and populate every field of the structured schema.

CRITICAL RULES:
- Extract EVERY experience entry, education entry, skill, language and link you find — do not skip any.
- Dates MUST be in YYYY-MM format. If only a year is given, use YYYY-01. Current/ongoing positions get endDate = "".
- experience.description: join all bullet points with a newline character (\\n). Do NOT include leading "•", "-" or "*". Each bullet is one plain sentence or phrase.
- experience.technologies: comma-separated string of all technologies mentioned for that role (e.g. "React, TypeScript, Node.js"). Empty string if none found.
- skills: list each skill as a separate entry. If skills are listed as a comma-separated line in the CV, split them into individual items.
- For any field not found in the CV, use an empty string "" (never null).
- links: detect LinkedIn, GitHub, portfolio, or any URL mentioned and add them with an appropriate label.

CV TEXT:
${truncated}`

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: CV_EDITOR_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(60000),
      }
    )

    if (!r.ok) {
      const errBody = await r.text().catch(() => '')
      console.error('[parse-cv] Gemini error', r.status, errBody)
      return res.status(502).json({ error: `Gemini respondió con error ${r.status}` })
    }

    const data = await r.json()
    const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()

    if (!rawText) {
      return res.status(502).json({ error: 'Gemini devolvió una respuesta vacía' })
    }

    let parsed
    try {
      const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      console.error('[parse-cv] JSON parse failed:', rawText.slice(0, 300))
      return res.status(502).json({ error: 'La respuesta de Gemini no era JSON válido' })
    }

    // ── Regex fallback for email/phone if Gemini left them empty ────────────
    if (!parsed.email) {
      const emailMatch = truncated.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
      if (emailMatch) parsed.email = emailMatch[0]
    }
    if (!parsed.phone) {
      const phoneMatch = truncated.match(/(\+?\d[\d\s\-().]{6,}\d)/)
      if (phoneMatch) parsed.phone = phoneMatch[1].trim()
    }

    console.log('[parse-cv] OK — fields:', Object.keys(parsed).join(', '),
      '| experience:', parsed.experience?.length ?? 0,
      '| education:', parsed.education?.length ?? 0,
      '| skills:', parsed.skills?.length ?? 0)

    res.json(parsed)
  } catch (err) {
    console.error('[parse-cv] Error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno del proxy' })
  }
})

app.listen(PORT, () => {
  console.log(`\nJobTaylor Proxy corriendo en http://localhost:${PORT}`)
  console.log(`  Gemini key : ${GEMINI_API_KEY ? '✓ set' : '✗ NOT SET — cloud features will fail'}`)
  console.log(`  Gemini model: ${GEMINI_MODEL}`)
  console.log(`  Tavily key : ${TAVILY_API_KEY ? '✓ set' : '✗ NOT SET — job enrichment will fail'}`)
  console.log(`  GET  /health    — comprueba estado`)
  console.log(`  POST /enrich    — enriquece una oferta a partir de su URL`)
  console.log(`  POST /score     — compatibilidad CV ↔ oferta (0-100)`)
  console.log(`  POST /tailor    — genera CV adaptado con guardrails`)
  console.log(`  POST /parse-cv  — parsea texto de CV con heurística + Gemini\n`)
})
