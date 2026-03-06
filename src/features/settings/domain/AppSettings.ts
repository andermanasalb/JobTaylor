export type AiMode = 'cloud'
export type OutputLanguage = 'EN' | 'ES'
export type CvTemplate = 'modern' | 'classic' | 'minimal'
export type ExportFormat = 'pdf' | 'docx' | 'md'

export interface AppSettings {
  aiMode: AiMode
  outputLanguage: OutputLanguage
  template: CvTemplate
  /** 0–100. Higher = more strict (less creative liberty). Default: 70 */
  strictness: number
  exportFormat: ExportFormat
}

export const defaultSettings: AppSettings = {
  aiMode: 'cloud',
  outputLanguage: 'ES',
  template: 'modern',
  strictness: 70,
  exportFormat: 'pdf',
}
