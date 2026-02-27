import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { ExportOptions } from './ExportOptions'
import { generateCvPdfBlob } from './exportPdf'
import { generateCvDocxBlob } from './exportDocx'
import { generateCvMarkdownBlob } from './exportMarkdown'
import { downloadFile, sanitizeFilename } from './downloadFile'

function buildFilename(cv: TailoredCv, ext: string): string {
  const name = sanitizeFilename(
    `${cv.tailoredData.personalInfo.fullName}-tailored`,
  )
  return `${name}.${ext}`
}

/**
 * Generate and immediately download a tailored CV in the chosen format,
 * applying the selected template and optional profile photo.
 */
export async function exportTailoredCv(
  cv: TailoredCv,
  options: ExportOptions,
): Promise<void> {
  const { format, template, photo } = options
  switch (format) {
    case 'pdf': {
      const blob = await generateCvPdfBlob(cv, template, photo)
      downloadFile(blob, buildFilename(cv, 'pdf'))
      break
    }
    case 'docx': {
      const blob = await generateCvDocxBlob(cv, template, photo)
      downloadFile(blob, buildFilename(cv, 'docx'))
      break
    }
    case 'md': {
      // Markdown is plain text — no template or photo
      const blob = generateCvMarkdownBlob(cv)
      downloadFile(blob, buildFilename(cv, 'md'))
      break
    }
  }
}
