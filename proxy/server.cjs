/**
 * JobTaylor Local Proxy Server
 *
 * Corre en localhost:3001. Hace dos cosas:
 *   POST /enrich  → fetch de la URL de la oferta + limpieza HTML + llamada a Ollama
 *   GET  /health  → comprueba que el proxy y Ollama están activos
 *
 * Uso: node proxy/server.js   (o npm run proxy)
 */

const express = require('express')
const { parse } = require('node-html-parser')

const PORT = 3001
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b'
// Límite de caracteres del texto extraído que se manda a Ollama (evitar context overflow)
const MAX_TEXT_CHARS = 8000

const app = express()
app.use(express.json())

// CORS: permite peticiones desde cualquier origen local (Vite dev o Vercel prod)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ---------------------------------------------------------------------------
// GET /health — comprueba proxy + Ollama
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!r.ok) throw new Error(`Ollama responded ${r.status}`)
    res.json({ proxy: 'ok', ollama: 'ok', model: OLLAMA_MODEL })
  } catch (err) {
    res.status(503).json({ proxy: 'ok', ollama: 'unreachable', error: String(err) })
  }
})

// ---------------------------------------------------------------------------
// POST /enrich  — body: { url: string }
// ---------------------------------------------------------------------------
app.post('/enrich', async (req, res) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  // 1. Fetch la página de la oferta
  let rawHtml
  try {
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`)
    rawHtml = await pageRes.text()
  } catch (err) {
    return res.status(502).json({ error: `No se pudo obtener la página: ${err}` })
  }

  // 2. Extraer texto limpio del HTML
  const root = parse(rawHtml)
  // Eliminar scripts, estilos, navs, headers, footers
  for (const el of root.querySelectorAll('script, style, nav, header, footer, aside, [role="navigation"]')) {
    el.remove()
  }
  const text = root.innerText
    .replace(/\s{3,}/g, '\n\n')   // colapsar espacios en blanco excesivos
    .trim()
    .slice(0, MAX_TEXT_CHARS)

  if (text.length < 100) {
    return res.status(422).json({ error: 'No se pudo extraer texto suficiente de la página' })
  }

  // 3. Llamar a Ollama
  const prompt = `Eres un analista experto en selección de personal. Tu tarea es analizar el contenido de una oferta de empleo y extraer toda la información relevante de forma estructurada y detallada.

INSTRUCCIONES IMPORTANTES:
- Lee el texto de la oferta con atención y extrae TODA la información presente, sin inventar ni suponer nada que no esté en el texto.
- La descripción debe ser rica y completa: explica el rol, el equipo, el contexto del proyecto, el impacto esperado del puesto y la cultura de la empresa si se menciona. Mínimo 4-5 párrafos bien desarrollados.
- Los requisitos deben ser los que la oferta marca como IMPRESCINDIBLES o OBLIGATORIOS (años de experiencia, titulación, idiomas requeridos, tecnologías o habilidades sin las cuales no se considera el perfil).
- Los deseables son los que la oferta marca como VALORADOS, PLUS o NICE TO HAVE (no obligatorios).
- En "habilidades" incluye TODO lo mencionado en la oferta que sea relevante para el perfil: tecnologías concretas, lenguajes de programación, frameworks, herramientas, plataformas cloud, metodologías (Agile, Scrum, Kanban...), habilidades blandas destacadas (liderazgo, comunicación, trabajo en equipo...), idiomas si se mencionan, certificaciones, etc. Sé exhaustivo.
- Si hay información sobre la empresa (sector, tamaño, misión, producto, cultura) redáctala en "aboutCompany".
- Devuelve ÚNICAMENTE el JSON, sin texto adicional, sin markdown, sin bloques de código.

El JSON debe tener exactamente esta estructura:
{
  "description": "Descripción completa y detallada del puesto en 4-5 párrafos. Incluye: qué hará el candidato día a día, en qué equipo trabajará, qué impacto tendrá, qué tipo de proyectos, y cualquier información sobre condiciones laborales (salario, beneficios, modalidad de trabajo, horarios) si se menciona.",
  "requirements": [
    "Requisito imprescindible 1 — sé específico (ej: '3+ años de experiencia con React', no solo 'experiencia en frontend')",
    "Requisito imprescindible 2",
    "..."
  ],
  "niceToHave": [
    "Deseable 1 — sé específico",
    "Deseable 2",
    "..."
  ],
  "techStack": [
    "Tecnología o habilidad clave 1",
    "Tecnología o habilidad clave 2",
    "..."
  ],
  "aboutCompany": "Párrafo sobre la empresa: sector, producto, tamaño, cultura, misión. Si no hay información suficiente, devuelve null."
}

Contenido de la oferta:
---
${text}
---

Recuerda: responde SOLO con el JSON válido.`

  let ollamaRes
  try {
    ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(120000),
    })
    if (!ollamaRes.ok) throw new Error(`Ollama error ${ollamaRes.status}`)
  } catch (err) {
    return res.status(503).json({ error: `Ollama no disponible: ${err}` })
  }

  const ollamaData = await ollamaRes.json()
  const raw = ollamaData.response ?? ''

  // 4. Parsear el JSON devuelto por Ollama
  let enriched
  try {
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    enriched = JSON.parse(cleaned)
  } catch {
    return res.status(500).json({ error: 'El modelo devolvió una respuesta no parseable', raw })
  }

  res.json(enriched)
})

// ---------------------------------------------------------------------------
// POST /score — body: { cv: BaseCv, jobTitle, jobDescription }
// Devuelve { score: number } — compatibilidad 0-100 entre el CV y la oferta
// ---------------------------------------------------------------------------
app.post('/score', async (req, res) => {
  const { cv, jobTitle, jobDescription } = req.body
  if (!cv || !jobTitle || !jobDescription) {
    return res.status(400).json({ error: 'cv, jobTitle y jobDescription son obligatorios' })
  }

  // Construir resumen del CV para el prompt
  const skillNames = (cv.skills || []).map(s => s.name).join(', ')
  const expSummary = (cv.experience || [])
    .map(e => `${e.title} en ${e.company} (${e.startDate}–${e.endDate || 'presente'})`)
    .join('; ')
  const cvText = [
    cv.summary ? `Resumen: ${cv.summary}` : '',
    skillNames ? `Skills: ${skillNames}` : '',
    expSummary ? `Experiencia: ${expSummary}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Eres un experto en selección de personal. Evalúa la compatibilidad entre este candidato y esta oferta de trabajo.

CV DEL CANDIDATO:
${cvText}

OFERTA:
Título: ${jobTitle}
Descripción: ${jobDescription.slice(0, 2000)}

Devuelve SOLO un número entero del 0 al 100 representando el % de compatibilidad. Sin texto adicional, solo el número.`

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(60000),
    })
    if (!ollamaRes.ok) throw new Error(`Ollama error ${ollamaRes.status}`)
    const data = await ollamaRes.json()
    const raw = (data.response ?? '').trim()
    const score = parseInt(raw.replace(/[^0-9]/g, ''), 10)
    if (isNaN(score)) throw new Error(`Score no parseable: ${raw}`)
    res.json({ score: Math.min(100, Math.max(0, score)) })
  } catch (err) {
    res.status(503).json({ error: `Error al calcular score: ${err}` })
  }
})

// ---------------------------------------------------------------------------
// POST /tailor — body: { cv: BaseCv, jobTitle, jobDescription, enrichedDescription, strictness }
// Genera un CV adaptado a la oferta respetando los guardrails
// ---------------------------------------------------------------------------
app.post('/tailor', async (req, res) => {
  const { cv, jobTitle, jobDescription, enrichedDescription, strictness = 70, language = 'ES' } = req.body
  if (!cv || !jobTitle) {
    return res.status(400).json({ error: 'cv y jobTitle son obligatorios' })
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

NIVEL DE ADAPTACIÓN: ${creativityInstruction}

IDIOMA DE SALIDA: ${languageInstruction}

CV ORIGINAL (JSON):
${cvJson}

OFERTA DE TRABAJO:
Título: ${jobTitle}
${jobContext.slice(0, 3000)}

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "tailoredCv": { ...mismo formato que el CV original pero adaptado... },
  "gaps": ["habilidad o requisito que pide la oferta pero no está en el CV"],
  "suggestions": ["sugerencia para mejorar el perfil sin inventar nada"]
}

Solo el JSON, sin texto adicional.`

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: 'json' }),
      signal: AbortSignal.timeout(180000),
    })
    if (!ollamaRes.ok) throw new Error(`Ollama error ${ollamaRes.status}`)
    const data = await ollamaRes.json()
    const raw = (data.response ?? '').trim()
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    const result = JSON.parse(cleaned)
    res.json(result)
  } catch (err) {
    res.status(503).json({ error: `Error al adaptar CV: ${err}` })
  }
})

// ---------------------------------------------------------------------------
// Parser heurístico completo de CV (no depende del modelo para campos planos)
// El modelo solo se usa para el summary (campo narrativo libre).
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
// Estrategia: heurística determinista para todos los campos estructurados.
// Ollama (qwen2.5:0.5b) solo para campos narrativos que la heurística no puede
// generar: summary (si no hay sección SUMMARY) y title (si no está en el header).
// El modelo es demasiado pequeño para JSON complejo — no lo usamos para arrays.
// ---------------------------------------------------------------------------
app.post('/parse-cv', async (req, res) => {
  const { text } = req.body
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return res.status(400).json({ error: 'text es obligatorio y debe tener al menos 20 caracteres' })
  }

  const truncated = text.trim().slice(0, MAX_TEXT_CHARS)
  const lines = truncated.split(/\r?\n/).map(l => l.trim())

  // ── 1. Extracción heurística completa (determinista, fiable) ──────────────
  const { fullName, title: hTitle, location } = extractHeader(lines)
  const email    = extractEmail(truncated)
  const phone    = extractPhone(truncated)
  const links    = extractLinks(truncated)
  const skills   = extractSkills(lines)
  const languages = extractLanguages(lines)
  const experience = extractExperience(lines)
  const education  = extractEducation(lines)

  // Summary: extraemos la sección SUMMARY/PROFILE tal cual si existe
  const summaryLines = getSectionLines(lines, /^(SUMMARY|PROFILE|ABOUT|OBJECTIVE|RESUMEN|PERFIL|EXTRACTO)$/i)
  const summaryRaw = summaryLines.join(' ').trim()

  // ── 2. Ollama: solo para campos narrativos que la heurística no cubre bien ──
  // Llamamos a Ollama en paralelo para summary y title si alguno falta
  const needSummary = !summaryRaw
  const needTitle   = !hTitle

  /**
   * Llama a Ollama con un prompt de texto libre (no JSON) para extraer
   * un único campo narrativo. Devuelve string o null si falla.
   */
  async function ollamaExtract(prompt) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
        signal: AbortSignal.timeout(45000),
      })
      if (!r.ok) return null
      const data = await r.json()
      const result = (data.response ?? '').trim()
      // Rechaza respuestas vacías o que parezcan JSON (significa que el modelo se confundió)
      if (!result || result.startsWith('{') || result.startsWith('[')) return null
      return result
    } catch {
      return null
    }
  }

  // Preparamos el texto de cabecera del CV (primeras líneas) para dar contexto al modelo
  const cvHeader = lines.slice(0, 30).join('\n')
  const cvFull   = truncated.slice(0, 3000) // contexto limitado para el modelo pequeño

  // Lanzamos las llamadas en paralelo solo si son necesarias
  const [aiSummary, aiTitle] = await Promise.all([
    needSummary
      ? ollamaExtract(
          `Read this CV and write a professional summary in 2-3 sentences describing the person's background, key skills and experience. Write only the summary text, no labels, no JSON, no bullet points.\n\nCV:\n${cvFull}`
        )
      : Promise.resolve(null),
    needTitle
      ? ollamaExtract(
          `Read the following CV header and extract the person's professional job title (e.g. "Senior Frontend Developer", "Data Scientist", "Product Manager"). Return ONLY the job title, nothing else.\n\nCV header:\n${cvHeader}`
        )
      : Promise.resolve(null),
  ])

  // ── 3. Resultado final: heurística + Ollama para los huecos ───────────────
  res.json({
    fullName,
    email,
    phone,
    location,
    title:    hTitle   || aiTitle   || null,
    summary:  summaryRaw || aiSummary || null,
    experience,
    education,
    skills,
    languages,
    links,
  })
})

app.listen(PORT, () => {
  console.log(`\nJobTaylor Proxy corriendo en http://localhost:${PORT}`)
  console.log(`  Ollama URL : ${OLLAMA_URL}`)
  console.log(`  Modelo     : ${OLLAMA_MODEL}`)
  console.log(`  GET  /health    — comprueba estado`)
  console.log(`  POST /enrich    — enriquece una oferta a partir de su URL`)
  console.log(`  POST /score     — compatibilidad CV ↔ oferta (0-100)`)
  console.log(`  POST /tailor    — genera CV adaptado con guardrails`)
  console.log(`  POST /parse-cv  — parsea texto de CV con Ollama\n`)
})
