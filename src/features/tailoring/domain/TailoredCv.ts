import type { BaseCv } from '../../cv-base/domain/BaseCv'

export interface TailoredCv {
  id: string
  baseCvId: string
  jobPostingId: string
  jobTitle: string // title of the job posting this CV was tailored for
  jobDescription: string // description used during tailoring (raw or enriched)
  score: number | null // AI compatibility score (0-100), null if not computed
  tailoredData: BaseCv // derived from base CV — no invented content
  gaps: string[] // job requirements not present in the base CV
  suggestions: string[] // improvement hints (never fabricated claims)
  guardrailsApplied: true // always true — the system never invents experience
  createdAt: Date
}
