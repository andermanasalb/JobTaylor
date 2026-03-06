import type { BaseCv } from '@/features/cv-base/domain/BaseCv'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { ExportOptions } from './ExportOptions'
import { generateCvPdfBlob } from './exportPdf'
import { generateCvDocxBlob } from './exportDocx'
import { generateCvMarkdownBlob } from './exportMarkdown'
import { downloadFile, sanitizeFilename } from './downloadFile'

/**
 * Wraps a BaseCv as a TailoredCv shell so it can be passed to the
 * existing export pipeline without changes.
 */
function wrapAsExportable(cv: BaseCv): TailoredCv {
  return {
    id: cv.id,
    baseCvId: cv.id,
    jobPostingId: '',
    jobTitle: '',
    jobDescription: '',
    score: null,
    tailoredData: cv,
    gaps: [],
    suggestions: [],
    guardrailsApplied: true,
    createdAt: cv.createdAt,
  }
}

/**
 * Generate and immediately download a base CV in the chosen format,
 * applying the selected template and optional profile photo.
 */
export async function exportBaseCv(cv: BaseCv, options: ExportOptions): Promise<void> {
  const wrapped = wrapAsExportable(cv)
  const { format, template, photo } = options
  const filename = sanitizeFilename(cv.personalInfo.fullName || 'cv')

  switch (format) {
    case 'pdf': {
      const blob = await generateCvPdfBlob(wrapped, template, photo)
      downloadFile(blob, `${filename}.pdf`)
      break
    }
    case 'docx': {
      const blob = await generateCvDocxBlob(wrapped, template, photo)
      downloadFile(blob, `${filename}.docx`)
      break
    }
    case 'md': {
      const blob = generateCvMarkdownBlob(wrapped)
      downloadFile(blob, `${filename}.md`)
      break
    }
  }
}
