import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
} from 'docx'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { Experience, Education } from '@/features/cv-base/domain/BaseCv'
import type { CvTemplate } from '@/features/settings/domain/AppSettings'
import {
  CV_THEMES,
  TITLE_PT, CONTACT_PT, LINK_PT, BODY_PT, SUB_PT, ENTRY_TITLE_PT,
  MARGIN_MM, PHOTO_SIZE_MM, TEXT_COL_MM,
  ptToHp, mmToTwips, mmToPx,
} from './cvThemes'
import type { CvThemeSpec } from './cvThemes'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const

// ---------------------------------------------------------------------------
// Layout — mirror PDF geometry exactly
// ---------------------------------------------------------------------------

const MARGIN_TW      = mmToTwips(MARGIN_MM)       // 20 mm page margins
const TEXT_COL_TW    = mmToTwips(TEXT_COL_MM)     // text column when photo present (131 mm)
const PHOTO_COL_TW   = mmToTwips(PHOTO_SIZE_MM)   // photo column (33 mm)
const PHOTO_PX       = mmToPx(PHOTO_SIZE_MM)       // 33 mm @ 96 dpi → 125 px

// Spacing in twips (matching PDF mm values: 1 mm ≈ 56.69 twips)
const SECTION_GAP_TW = mmToTwips(8)   // 8 mm gap before section headings
const ENTRY_GAP_TW   = mmToTwips(3)   // 3 mm gap between experience/education entries

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

function sectionHeading(title: string, theme: CvThemeSpec): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: ptToHp(theme.sectionTitlePt),
        color: theme.sectionTitleColor,
      }),
    ],
    border: theme.showSectionRule
      ? { bottom: { color: 'B4B4B4', space: 1, style: BorderStyle.SINGLE, size: 6 } }
      : undefined,
    // before matches PDF SECTION_GAP; after gives a small breathing room before body
    spacing: { before: SECTION_GAP_TW, after: 80 },
  })
}

function noBorderCell(children: (Paragraph | Table)[]): TableCell {
  return new TableCell({
    children,
    verticalAlign: VerticalAlign.TOP,
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  })
}

function experienceParagraphs(exp: Experience, theme: CvThemeSpec): Paragraph[] {
  const start = formatDate(exp.startDate)
  const end   = exp.endDate ? formatDate(exp.endDate) : 'Present'

  const paras: Paragraph[] = [
    // Entry title — matches PDF ENTRY_TITLE_PT (10 pt)
    new Paragraph({
      children: [
        new TextRun({
          text: `${exp.title} — ${exp.company}`,
          bold: true,
          size: ptToHp(ENTRY_TITLE_PT),
          color: theme.nameColor,
        }),
      ],
      spacing: { before: ENTRY_GAP_TW, after: 0 },
    }),
    // Date / location line — matches PDF SUB_PT (8 pt)
    new Paragraph({
      children: [
        new TextRun({
          text: `${start} – ${end}${exp.location ? `  |  ${exp.location}` : ''}`,
          italics: true,
          size: ptToHp(SUB_PT),
          color: theme.subColor,
        }),
      ],
      spacing: { before: 0, after: 80 },
    }),
  ]

  // Bullet points — matches PDF BODY_PT (9 pt)
  for (const bullet of exp.description) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: bullet, size: ptToHp(BODY_PT), color: theme.bodyColor })],
      bullet: { level: 0 },
      spacing: { before: 0, after: 40 },
    }))
  }

  if (exp.technologies?.length) {
    paras.push(new Paragraph({
      children: [
        new TextRun({ text: 'Tech: ', bold: true, size: ptToHp(SUB_PT), color: theme.subColor }),
        new TextRun({ text: exp.technologies.join(', '), size: ptToHp(SUB_PT), color: theme.subColor }),
      ],
      spacing: { before: 0, after: 40 },
    }))
  }

  return paras
}

function educationParagraphs(edu: Education, theme: CvThemeSpec): Paragraph[] {
  const start = formatDate(edu.startDate)
  const end   = edu.endDate ? formatDate(edu.endDate) : 'Present'

  const paras: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: `${edu.degree} — ${edu.institution}`,
          bold: true,
          size: ptToHp(ENTRY_TITLE_PT),
          color: theme.nameColor,
        }),
      ],
      spacing: { before: ENTRY_GAP_TW, after: 0 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${start} – ${end}`,
          italics: true,
          size: ptToHp(SUB_PT),
          color: theme.subColor,
        }),
      ],
      spacing: { before: 0, after: 80 },
    }),
  ]

  if (edu.description) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: edu.description, size: ptToHp(BODY_PT), color: theme.bodyColor })],
      spacing: { before: 0, after: 40 },
    }))
  }

  return paras
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? dataUrl
  const binary = atob(base64)
  const arr    = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return arr
}

function getImageType(dataUrl: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  if (dataUrl.startsWith('data:image/png')) return 'png'
  if (dataUrl.startsWith('data:image/gif')) return 'gif'
  if (dataUrl.startsWith('data:image/bmp')) return 'bmp'
  return 'jpg'
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function generateCvDocxBlob(
  tailoredCv: TailoredCv,
  template: CvTemplate = 'modern',
  photo?: string,
): Promise<Blob> {
  const cv    = tailoredCv.tailoredData
  const theme = CV_THEMES[template]

  const contactParts = [cv.personalInfo.email]
  if (cv.personalInfo.phone)    contactParts.push(cv.personalInfo.phone)
  if (cv.personalInfo.location) contactParts.push(cv.personalInfo.location)

  const children: (Paragraph | Table)[] = []

  // ── Header ──────────────────────────────────────────────────────────────
  // All templates use LEFT alignment to match PDF
  const headerParas: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: cv.personalInfo.fullName,
          bold: true,
          size: ptToHp(theme.namePt),
          color: theme.nameColor,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: ptToHp(BODY_PT) },
    }),
  ]

  if (cv.personalInfo.title) {
    headerParas.push(new Paragraph({
      children: [
        new TextRun({ text: cv.personalInfo.title, size: ptToHp(TITLE_PT), color: theme.titleColor }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: ptToHp(BODY_PT) },
    }))
  }

  headerParas.push(new Paragraph({
    children: [
      new TextRun({
        text: contactParts.join('  |  '),
        size: ptToHp(CONTACT_PT),
        color: theme.contactColor,
      }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 60 },
  }))

  if (cv.links.length > 0) {
    const linkText = cv.links.map(l => `${l.label}: ${l.url}`).join('  |  ')
    headerParas.push(new Paragraph({
      children: [new TextRun({ text: linkText, size: ptToHp(LINK_PT), color: theme.linkColor })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 120 },
    }))
  }

  // If photo: place in a 2-column borderless table [text | photo]
  // Column widths mirror PDF geometry (text = 131 mm, photo = 33 mm)
  if (photo) {
    try {
      const imageData = dataUrlToUint8Array(photo)
      const imgType   = getImageType(photo)
      const photoCell = noBorderCell([
        new Paragraph({
          children: [
            new ImageRun({
              type: imgType,
              data: imageData,
              // PHOTO_PX ≈ 125 px = 33 mm @ 96 dpi — matches PDF PHOTO_SIZE
              transformation: { width: PHOTO_PX, height: PHOTO_PX },
            }),
          ],
          alignment: AlignmentType.RIGHT,
        }),
      ])
      const textCell = noBorderCell(headerParas)
      children.push(new Table({
        rows: [new TableRow({ children: [textCell, photoCell] })],
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [TEXT_COL_TW, PHOTO_COL_TW],
        borders: {
          top: NO_BORDER,
          bottom: NO_BORDER,
          left: NO_BORDER,
          right: NO_BORDER,
          insideHorizontal: NO_BORDER,
          insideVertical: NO_BORDER,
        },
      }))
    } catch {
      // Photo rendering failed — fall back to text-only header
      children.push(...headerParas)
    }
  } else {
    children.push(...headerParas)
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  if (cv.summary) {
    children.push(sectionHeading('Summary', theme))
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.summary, size: ptToHp(BODY_PT), color: theme.bodyColor })],
      spacing: { before: 0, after: 120 },
    }))
  }

  // ── Experience ───────────────────────────────────────────────────────────
  if (cv.experience.length > 0) {
    children.push(sectionHeading('Experience', theme))
    for (const exp of cv.experience) {
      children.push(...experienceParagraphs(exp, theme))
    }
  }

  // ── Education ────────────────────────────────────────────────────────────
  if (cv.education.length > 0) {
    children.push(sectionHeading('Education', theme))
    for (const edu of cv.education) {
      children.push(...educationParagraphs(edu, theme))
    }
  }

  // ── Skills ───────────────────────────────────────────────────────────────
  if (cv.skills.length > 0) {
    children.push(sectionHeading('Skills', theme))
    const skillText = cv.skills.map(s => s.level ? `${s.name} (${s.level})` : s.name).join(', ')
    children.push(new Paragraph({
      children: [new TextRun({ text: skillText, size: ptToHp(BODY_PT), color: theme.bodyColor })],
      spacing: { before: 0, after: 120 },
    }))
  }

  // ── Languages ────────────────────────────────────────────────────────────
  if (cv.languages.length > 0) {
    children.push(sectionHeading('Languages', theme))
    const langText = cv.languages.map(l => `${l.name} (${l.level})`).join('  |  ')
    children.push(new Paragraph({
      children: [new TextRun({ text: langText, size: ptToHp(BODY_PT), color: theme.bodyColor })],
      spacing: { before: 0, after: 120 },
    }))
  }

  // ── Document — explicit 20 mm margins matching PDF ───────────────────────
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    MARGIN_TW,
            right:  MARGIN_TW,
            bottom: MARGIN_TW,
            left:   MARGIN_TW,
          },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  return new Blob([blob], { type: DOCX_MIME })
}
