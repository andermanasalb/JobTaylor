import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'

function formatDate(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  if (!month) return year
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function generateCvMarkdown(tailoredCv: TailoredCv): string {
  const cv = tailoredCv.tailoredData
  const lines: string[] = []

  // --- Header ---
  lines.push(`# ${cv.personalInfo.fullName}`)
  if (cv.personalInfo.title) lines.push(`**${cv.personalInfo.title}**`)
  lines.push('')

  const contact: string[] = [cv.personalInfo.email]
  if (cv.personalInfo.phone) contact.push(cv.personalInfo.phone)
  if (cv.personalInfo.location) contact.push(cv.personalInfo.location)
  lines.push(contact.join(' | '))

  if (cv.links.length > 0) {
    lines.push(cv.links.map(l => `[${l.label}](${l.url})`).join(' | '))
  }

  // --- Summary ---
  if (cv.summary) {
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## Summary')
    lines.push('')
    lines.push(cv.summary)
  }

  // --- Experience ---
  if (cv.experience.length > 0) {
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## Experience')
    for (const exp of cv.experience) {
      lines.push('')
      lines.push(`### ${exp.title} — ${exp.company}`)
      const start = formatDate(exp.startDate)
      const end = exp.endDate ? formatDate(exp.endDate) : 'Present'
      const dateLine = `*${start} – ${end}${exp.location ? ` | ${exp.location}` : ''}*`
      lines.push(dateLine)
      lines.push('')
      for (const bullet of exp.description) {
        lines.push(`- ${bullet}`)
      }
      if (exp.technologies && exp.technologies.length > 0) {
        lines.push('')
        lines.push(`**Technologies:** ${exp.technologies.join(', ')}`)
      }
    }
  }

  // --- Education ---
  if (cv.education.length > 0) {
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## Education')
    for (const edu of cv.education) {
      lines.push('')
      lines.push(`### ${edu.degree} — ${edu.institution}`)
      const start = formatDate(edu.startDate)
      const end = edu.endDate ? formatDate(edu.endDate) : 'Present'
      lines.push(`*${start} – ${end}${edu.location ? ` | ${edu.location}` : ''}*`)
      if (edu.description) {
        lines.push('')
        lines.push(edu.description)
      }
    }
  }

  // --- Skills ---
  if (cv.skills.length > 0) {
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## Skills')
    lines.push('')
    lines.push(
      cv.skills
        .map(s => (s.level ? `${s.name} *(${s.level})*` : s.name))
        .join(', '),
    )
  }

  // --- Languages ---
  if (cv.languages.length > 0) {
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## Languages')
    lines.push('')
    lines.push(cv.languages.map(l => `${l.name} (${l.level})`).join(' | '))
  }

  lines.push('')
  return lines.join('\n')
}

export function generateCvMarkdownBlob(tailoredCv: TailoredCv): Blob {
  const md = generateCvMarkdown(tailoredCv)
  return new Blob([md], { type: 'text/markdown;charset=utf-8' })
}
