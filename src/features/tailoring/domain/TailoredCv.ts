import type { BaseCv } from '../../cv-base/domain/BaseCv'

export interface TailoredCv {
  id: string
  baseCvId: string
  jobPostingId: string
  tailoredData: BaseCv // derived from base CV — no invented content
  gaps: string[] // job requirements not present in the base CV
  suggestions: string[] // improvement hints (never fabricated claims)
  guardrailsApplied: true // always true — the system never invents experience
  createdAt: Date
}
