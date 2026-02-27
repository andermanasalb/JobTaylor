import type { BaseCv } from '../../../cv-base/domain/BaseCv'
import type { JobPosting } from '../../../job-postings/domain/JobPosting'

export interface AiTailorResult {
  tailoredData: BaseCv
  gaps: string[] // requirements in the job not present in the CV
  suggestions: string[] // improvement hints without fabricating content
}

/**
 * Port for AI-powered CV tailoring.
 * Stage 0: FakeAiClient (deterministic, no HTTP).
 * Stage 1+: real AI client (OpenAI / Anthropic) behind this interface.
 *
 * GUARDRAIL: implementations MUST NOT invent experience, employers,
 * titles, dates, degrees or certifications.
 */
export interface AiClient {
  tailorCv(baseCv: BaseCv, jobPosting: JobPosting): Promise<AiTailorResult>
}
