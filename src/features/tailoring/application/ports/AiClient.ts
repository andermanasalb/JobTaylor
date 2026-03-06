import type { BaseCv } from '../../../cv-base/domain/BaseCv'
import type { JobPosting } from '../../../job-postings/domain/JobPosting'

export interface AiTailorResult {
  tailoredData: BaseCv
  gaps: string[] // requirements in the job not present in the CV
  suggestions: string[] // improvement hints without fabricating content
}

/**
 * Per-call options that vary with each tailoring request.
 * Keeping them here (not in the constructor) allows a single stateless
 * AiClient instance to be registered in the DI container.
 */
export interface AiTailorOptions {
  /** 0 = conservative (minimal changes), 100 = aggressive rewrite. Default 70. */
  strictness?: number
  /** Enriched job description (Tavily + Gemini) for richer context. */
  enrichedDescription?: string
  /** ISO 639-1 language code for the output CV. Default 'ES'. */
  language?: string
}

/**
 * Port for AI-powered CV tailoring.
 * Stage 0: FakeAiClient (deterministic, no HTTP).
 * Stage 1+: GeminiAiClient via proxy.
 *
 * GUARDRAIL: implementations MUST NOT invent experience, employers,
 * titles, dates, degrees or certifications.
 */
export interface AiClient {
  tailorCv(baseCv: BaseCv, jobPosting: JobPosting, options?: AiTailorOptions): Promise<AiTailorResult>
}
