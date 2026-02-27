/**
 * Canonical CV theme definitions.
 * Both exportPdf.ts and exportDocx.ts import from here so that colors,
 * font sizes and decorations stay in sync between the two formats.
 */
import type { CvTemplate } from '@/features/settings/domain/AppSettings'

// ─── Fixed sizes (pt) — same for every template ────────────────────────────
/** Personal title under the name */
export const TITLE_PT        = 12
/** Contact / phone / location line */
export const CONTACT_PT      = 9
/** Links line */
export const LINK_PT         = 8
/** Body paragraphs (summary, bullets, skills…) */
export const BODY_PT         = 9
/** Dates, sub-labels */
export const SUB_PT          = 8
/** Experience / Education entry title ("Role — Company") */
export const ENTRY_TITLE_PT  = 10

// ─── Layout constants (mm) — match PDF page geometry ───────────────────────
export const PAGE_WIDTH_MM   = 210   // A4
export const MARGIN_MM       = 20
export const PHOTO_SIZE_MM   = 33    // square profile photo
export const PHOTO_GAP_MM    = 6     // gap between photo and text column
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2          // 170 mm
export const TEXT_COL_MM     = CONTENT_WIDTH_MM - PHOTO_SIZE_MM - PHOTO_GAP_MM // 131 mm (when photo present)

// ─── Theme spec ────────────────────────────────────────────────────────────
export interface CvThemeSpec {
  /** Name (heading) size in pt */
  namePt: number
  /** Section heading size in pt (e.g. "EXPERIENCE") */
  sectionTitlePt: number
  /** Draw a horizontal rule under section headings */
  showSectionRule: boolean
  // Colors — 6-digit hex, no leading #
  nameColor:         string
  titleColor:        string
  contactColor:      string
  linkColor:         string
  bodyColor:         string
  subColor:          string
  sectionTitleColor: string
}

export const CV_THEMES: Record<CvTemplate, CvThemeSpec> = {
  modern: {
    namePt: 20,
    sectionTitlePt: 11,
    showSectionRule: true,
    nameColor:         '141414',
    titleColor:        '465AB4',
    contactColor:      '646464',
    linkColor:         '3C64B4',
    bodyColor:         '3C3C3C',
    subColor:          '646464',
    sectionTitleColor: '282828',
  },
  classic: {
    namePt: 18,
    sectionTitlePt: 11,
    showSectionRule: false,
    nameColor:         '000000',
    titleColor:        '323232',
    contactColor:      '464646',
    linkColor:         '000000',
    bodyColor:         '323232',
    subColor:          '505050',
    sectionTitleColor: '000000',
  },
  minimal: {
    namePt: 16,
    sectionTitlePt: 9,
    showSectionRule: false,
    nameColor:         '1E1E1E',
    titleColor:        '828282',
    contactColor:      '969696',
    linkColor:         '6E6E6E',
    bodyColor:         '505050',
    subColor:          '8C8C8C',
    sectionTitleColor: 'A0A0A0',
  },
}

// ─── Conversion helpers ─────────────────────────────────────────────────────

/** 6-digit hex color → [r, g, b] tuple for jsPDF */
export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

/** Points → DOCX half-points (used for TextRun.size) */
export function ptToHp(pt: number): number {
  return pt * 2
}

/** Millimetres → DOCX twips (used for spacing / page margins / column widths) */
export function mmToTwips(mm: number): number {
  return Math.round((mm / 25.4) * 1440)
}

/** Millimetres → pixels at 96 dpi (used for ImageRun.transformation dimensions) */
export function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * 96)
}
