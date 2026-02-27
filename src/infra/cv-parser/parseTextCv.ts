/**
 * Lightweight heuristic CV text parser.
 *
 * Takes raw pasted/uploaded CV text and extracts structured fields using
 * simple regex patterns. Results are best-effort — the user is expected to
 * review and correct the output in the editor.
 */

export interface ParsedCv {
  fullName: string
  email: string
  phone: string
  location: string
  title: string
  summary: string
  experienceText: string
  educationText: string
  skills: string[]
  languages: string[]
  links: { label: string; url: string }[]
}

const SECTION_HEADINGS = /^(experience|work experience|employment|education|skills|languages?|links?|profile|summary|about|objective)\s*$/i

function extractSection(lines: string[], heading: RegExp): string {
  const start = lines.findIndex(l => heading.test(l.trim()))
  if (start === -1) return ''
  const end = lines.findIndex((l, i) => i > start && SECTION_HEADINGS.test(l.trim()))
  const slice = end === -1 ? lines.slice(start + 1) : lines.slice(start + 1, end)
  return slice.join('\n').trim()
}

export function parseTextCv(text: string): ParsedCv {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/)
  const email = emailMatch ? emailMatch[0] : ''

  // Phone
  const phoneMatch = text.match(/(\+?\d[\d\s\-().]{6,}\d)/)
  const phone = phoneMatch ? phoneMatch[1].trim() : ''

  // Links
  const urlRegex = /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g
  const rawUrls = text.match(urlRegex) ?? []
  const links = rawUrls.map(url => {
    if (url.includes('linkedin')) return { label: 'LinkedIn', url }
    if (url.includes('github')) return { label: 'GitHub', url }
    if (url.includes('portfolio') || url.includes('portfolio')) return { label: 'Portfolio', url }
    return { label: url.replace(/^https?:\/\//, '').split('/')[0], url }
  })

  // First non-email, non-phone, non-url line is likely the name
  const metaPattern = /[@+\d]|https?:\/\//
  const fullName = lines.find(l => l.length > 1 && l.length < 60 && !metaPattern.test(l)) ?? ''

  // Title: second non-meta line after the name
  const nameIdx = lines.indexOf(fullName)
  const title = nameIdx >= 0
    ? lines.slice(nameIdx + 1).find(l => l.length > 1 && l.length < 80 && !metaPattern.test(l)) ?? ''
    : ''

  // Summary
  const summaryText = extractSection(lines, /^(summary|profile|about|objective)$/i)

  // Experience & Education sections
  const experienceText = extractSection(lines, /^(experience|work experience|employment)$/i)
  const educationText = extractSection(lines, /^education$/i)

  // Skills — look for comma/semicolon separated lists inside a Skills section
  const skillsRaw = extractSection(lines, /^skills?$/i)
  const skills = skillsRaw
    .split(/[,;\n•\-–]/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 40)

  // Languages — similar approach
  const langsRaw = extractSection(lines, /^languages?$/i)
  const languages = langsRaw
    .split(/[,;\n•\-–]/)
    .map(s => s.replace(/\(.*?\)/g, '').trim())
    .filter(s => s.length > 1 && s.length < 30)

  return {
    fullName,
    email,
    phone,
    location: '',   // too ambiguous to extract reliably; user fills in
    title,
    summary: summaryText,
    experienceText,
    educationText,
    skills,
    languages,
    links,
  }
}
