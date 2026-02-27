import jsPDF from 'jspdf'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { CvTemplate } from '@/features/settings/domain/AppSettings'
import {
  CV_THEMES,
  TITLE_PT, CONTACT_PT, LINK_PT, BODY_PT, SUB_PT, ENTRY_TITLE_PT,
  MARGIN_MM, PAGE_WIDTH_MM, CONTENT_WIDTH_MM, TEXT_COL_MM, PHOTO_SIZE_MM, PHOTO_GAP_MM,
  hexToRgb,
} from './cvThemes'
import type { CvThemeSpec } from './cvThemes'

// ---------------------------------------------------------------------------
// Layout constants (keep as named aliases for readability)
// ---------------------------------------------------------------------------

const MARGIN        = MARGIN_MM
const PAGE_WIDTH    = PAGE_WIDTH_MM
const CONTENT_W     = CONTENT_WIDTH_MM
const TEXT_W_PHOTO  = TEXT_COL_MM          // text column width when photo is present
const PHOTO_SIZE    = PHOTO_SIZE_MM
const PHOTO_GAP     = PHOTO_GAP_MM         // gap between text col and photo col

const LINE_H        = 6                    // mm per body line
const SECTION_GAP   = 8                    // mm before each section
const ENTRY_GAP     = 3                    // mm between experience/education entries

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  if (!month) return year
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short',
  })
}

function checkPageBreak(doc: jsPDF, y: number, needed = LINE_H * 2): number {
  if (y + needed > doc.internal.pageSize.getHeight() - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function wrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  pt: number,
): number {
  doc.setFontSize(pt)
  for (const line of doc.splitTextToSize(text, maxW)) {
    y = checkPageBreak(doc, y)
    doc.text(line, x, y)
    y += LINE_H
  }
  return y
}

function addSectionTitle(
  doc: jsPDF,
  y: number,
  title: string,
  theme: CvThemeSpec,
): number {
  doc.setFontSize(theme.sectionTitlePt)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...hexToRgb(theme.sectionTitleColor))
  doc.text(title.toUpperCase(), MARGIN, y)
  y += 2
  if (theme.showSectionRule) {
    doc.setDrawColor(180, 180, 180)
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y)
  }
  y += LINE_H
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...hexToRgb(theme.bodyColor))
  return y
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function generateCvPdfBlob(
  tailoredCv: TailoredCv,
  template: CvTemplate = 'modern',
  photo?: string,
): Promise<Blob> {
  const cv = tailoredCv.tailoredData
  const theme = CV_THEMES[template]
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const hasPhoto  = !!photo
  // Text column is narrower when there is a photo on the right
  const textWidth = hasPhoto ? TEXT_W_PHOTO : CONTENT_W

  let y = MARGIN

  // --- Photo (top-right corner) ---
  if (hasPhoto) {
    const photoX = PAGE_WIDTH - MARGIN - PHOTO_SIZE
    try {
      doc.addImage(photo!, 'auto' as never, photoX, MARGIN, PHOTO_SIZE, PHOTO_SIZE)
    } catch { /* ignore unsupported format */ }
  }

  // --- Name ---
  doc.setFontSize(theme.namePt)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...hexToRgb(theme.nameColor))
  doc.text(cv.personalInfo.fullName, MARGIN, y)
  y += theme.namePt * 0.45

  // --- Personal title ---
  if (cv.personalInfo.title) {
    doc.setFontSize(TITLE_PT)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...hexToRgb(theme.titleColor))
    doc.text(cv.personalInfo.title, MARGIN, y)
    y += LINE_H
  }

  // --- Contact line ---
  const contactParts = [cv.personalInfo.email]
  if (cv.personalInfo.phone)    contactParts.push(cv.personalInfo.phone)
  if (cv.personalInfo.location) contactParts.push(cv.personalInfo.location)
  doc.setFontSize(CONTACT_PT)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...hexToRgb(theme.contactColor))
  for (const line of doc.splitTextToSize(contactParts.join('  |  '), textWidth)) {
    doc.text(line, MARGIN, y)
    y += LINE_H - 1
  }

  // --- Links ---
  if (cv.links.length > 0) {
    const linkText = cv.links.map(l => `${l.label}: ${l.url}`).join('  |  ')
    doc.setFontSize(LINK_PT)
    doc.setTextColor(...hexToRgb(theme.linkColor))
    for (const line of doc.splitTextToSize(linkText, textWidth)) {
      doc.text(line, MARGIN, y)
      y += LINE_H - 1
    }
  }

  // Ensure the text cursor clears the photo block before starting sections
  if (hasPhoto) y = Math.max(y, MARGIN + PHOTO_SIZE + PHOTO_GAP)

  y += SECTION_GAP

  // --- Summary ---
  if (cv.summary) {
    y = addSectionTitle(doc, y, 'Summary', theme)
    doc.setTextColor(...hexToRgb(theme.bodyColor))
    y = wrappedText(doc, cv.summary, MARGIN, y, CONTENT_W, BODY_PT)
    y += SECTION_GAP
  }

  // --- Experience ---
  if (cv.experience.length > 0) {
    y = addSectionTitle(doc, y, 'Experience', theme)
    for (const exp of cv.experience) {
      y = checkPageBreak(doc, y, LINE_H * 4)

      doc.setFontSize(ENTRY_TITLE_PT)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...hexToRgb(theme.nameColor))
      doc.text(`${exp.title} — ${exp.company}`, MARGIN, y)
      y += LINE_H - 1

      const start = formatDate(exp.startDate)
      const end   = exp.endDate ? formatDate(exp.endDate) : 'Present'
      doc.setFontSize(SUB_PT)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...hexToRgb(theme.subColor))
      doc.text(`${start} – ${end}${exp.location ? `  |  ${exp.location}` : ''}`, MARGIN, y)
      y += LINE_H

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...hexToRgb(theme.bodyColor))
      for (const bullet of exp.description) {
        y = checkPageBreak(doc, y)
        y = wrappedText(doc, `• ${bullet}`, MARGIN + 3, y, CONTENT_W - 3, BODY_PT)
      }

      if (exp.technologies?.length) {
        doc.setFontSize(SUB_PT)
        doc.setTextColor(...hexToRgb(theme.subColor))
        y = checkPageBreak(doc, y)
        doc.text(`Tech: ${exp.technologies.join(', ')}`, MARGIN + 3, y)
        y += LINE_H
      }

      y += ENTRY_GAP
    }
    y += SECTION_GAP - ENTRY_GAP
  }

  // --- Education ---
  if (cv.education.length > 0) {
    y = addSectionTitle(doc, y, 'Education', theme)
    for (const edu of cv.education) {
      y = checkPageBreak(doc, y, LINE_H * 3)

      doc.setFontSize(ENTRY_TITLE_PT)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...hexToRgb(theme.nameColor))
      doc.text(`${edu.degree} — ${edu.institution}`, MARGIN, y)
      y += LINE_H - 1

      const start = formatDate(edu.startDate)
      const end   = edu.endDate ? formatDate(edu.endDate) : 'Present'
      doc.setFontSize(SUB_PT)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...hexToRgb(theme.subColor))
      doc.text(`${start} – ${end}`, MARGIN, y)
      y += LINE_H

      if (edu.description) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...hexToRgb(theme.bodyColor))
        y = wrappedText(doc, edu.description, MARGIN + 3, y, CONTENT_W - 3, BODY_PT)
      }

      y += ENTRY_GAP
    }
    y += SECTION_GAP - ENTRY_GAP
  }

  // --- Skills ---
  if (cv.skills.length > 0) {
    y = addSectionTitle(doc, y, 'Skills', theme)
    doc.setTextColor(...hexToRgb(theme.bodyColor))
    const skillText = cv.skills.map(s => s.level ? `${s.name} (${s.level})` : s.name).join(', ')
    y = wrappedText(doc, skillText, MARGIN, y, CONTENT_W, BODY_PT)
    y += SECTION_GAP
  }

  // --- Languages ---
  if (cv.languages.length > 0) {
    y = addSectionTitle(doc, y, 'Languages', theme)
    doc.setTextColor(...hexToRgb(theme.bodyColor))
    const langText = cv.languages.map(l => `${l.name} (${l.level})`).join('  |  ')
    wrappedText(doc, langText, MARGIN, y, CONTENT_W, BODY_PT)
  }

  void y
  return new Blob([doc.output('blob')], { type: 'application/pdf' })
}
