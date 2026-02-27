import type { CvTemplate, ExportFormat } from '@/features/settings/domain/AppSettings'

export interface ExportOptions {
  format: ExportFormat
  template: CvTemplate
  /** Base64 data URL (e.g. "data:image/jpeg;base64,..."). Optional. */
  photo?: string
}
