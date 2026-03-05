import type { BaseCv } from './BaseCv'

/**
 * Converts a BaseCv into a human-readable plain-text string suitable for AI prompts.
 * Includes all relevant fields so the AI can do a thorough comparison against the job description.
 * No library dependencies — pure domain logic.
 */
export function cvToPlainText(cv: BaseCv): string {
  const lines: string[] = []

  // Personal info
  const { personalInfo } = cv
  lines.push(`Nombre: ${personalInfo.fullName}`)
  if (personalInfo.title) lines.push(`Título profesional: ${personalInfo.title}`)
  if (personalInfo.location) lines.push(`Ubicación: ${personalInfo.location}`)

  // Summary
  if (cv.summary) {
    lines.push('')
    lines.push('RESUMEN PROFESIONAL:')
    lines.push(cv.summary)
  }

  // Experience
  if (cv.experience.length > 0) {
    lines.push('')
    lines.push('EXPERIENCIA LABORAL:')
    for (const exp of cv.experience) {
      const period = exp.endDate ? `${exp.startDate} – ${exp.endDate}` : `${exp.startDate} – presente`
      lines.push(`• ${exp.title} en ${exp.company} (${period})`)
      if (exp.location) lines.push(`  Ubicación: ${exp.location}`)
      for (const desc of exp.description) {
        lines.push(`  - ${desc}`)
      }
      if (exp.technologies && exp.technologies.length > 0) {
        lines.push(`  Tecnologías: ${exp.technologies.join(', ')}`)
      }
    }
  }

  // Education
  if (cv.education.length > 0) {
    lines.push('')
    lines.push('FORMACIÓN ACADÉMICA:')
    for (const edu of cv.education) {
      const period = edu.endDate ? `${edu.startDate} – ${edu.endDate}` : `${edu.startDate} – presente`
      lines.push(`• ${edu.degree} — ${edu.institution} (${period})`)
      if (edu.description) lines.push(`  ${edu.description}`)
    }
  }

  // Skills
  if (cv.skills.length > 0) {
    lines.push('')
    lines.push('HABILIDADES:')
    lines.push(cv.skills.map(s => s.level ? `${s.name} (${s.level})` : s.name).join(', '))
  }

  // Languages
  if (cv.languages.length > 0) {
    lines.push('')
    lines.push('IDIOMAS:')
    lines.push(cv.languages.map(l => `${l.name}: ${l.level}`).join(', '))
  }

  return lines.join('\n')
}
