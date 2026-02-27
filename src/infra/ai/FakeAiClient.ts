import type { AiClient, AiTailorResult } from '../../features/tailoring/application/ports/AiClient'
import type { BaseCv } from '../../features/cv-base/domain/BaseCv'
import type { JobPosting } from '../../features/job-postings/domain/JobPosting'

/**
 * Deterministic fake AI client for Stage 0 testing.
 *
 * Rules:
 * - Does NOT invent experience, employers, titles, dates, degrees or certifications.
 * - Identifies gaps between job requirements and CV skills.
 * - Tailors the summary to reference the target role (using only existing content).
 * - All behaviour is deterministic so tests are stable.
 */
export class FakeAiClient implements AiClient {
  async tailorCv(baseCv: BaseCv, jobPosting: JobPosting): Promise<AiTailorResult> {
    const cvSkillNames = new Set(baseCv.skills.map(s => s.name.toLowerCase()))

    const gaps = jobPosting.requirements.skills.filter(
      skill => !cvSkillNames.has(skill.toLowerCase()),
    )

    const suggestions = gaps.map(
      gap => `Consider highlighting any existing experience with ${gap}, if applicable.`,
    )

    const tailoredSummary = baseCv.summary
      ? `${baseCv.summary} Applying for ${jobPosting.title} at ${jobPosting.company}.`
      : `Experienced professional applying for the ${jobPosting.title} position at ${jobPosting.company}.`

    const tailoredData: BaseCv = {
      ...baseCv,
      summary: tailoredSummary,
      updatedAt: new Date(),
    }

    return { tailoredData, gaps, suggestions }
  }
}
