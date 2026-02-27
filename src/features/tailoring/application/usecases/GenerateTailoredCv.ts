import type { CvRepository } from '../../../cv-base/application/ports/CvRepository'
import type { JobPostingRepository } from '../../../job-postings/application/ports/JobPostingRepository'
import type { TailoredCvRepository } from '../ports/TailoredCvRepository'
import type { AiClient } from '../ports/AiClient'
import type { TailoredCv } from '../../domain/TailoredCv'

interface Deps {
  cvRepo: CvRepository
  jobRepo: JobPostingRepository
  tailoredRepo: TailoredCvRepository
  aiClient: AiClient
}

interface Input {
  cvId: string
  jobPostingId: string
}

export async function generateTailoredCv(deps: Deps, input: Input): Promise<TailoredCv> {
  const { cvRepo, jobRepo, tailoredRepo, aiClient } = deps

  const baseCv = await cvRepo.findById(input.cvId)
  if (!baseCv) throw new Error('CV not found')

  const jobPosting = await jobRepo.findById(input.jobPostingId)
  if (!jobPosting) throw new Error('Job posting not found')

  const { tailoredData, gaps, suggestions } = await aiClient.tailorCv(baseCv, jobPosting)

  const tailoredCv: TailoredCv = {
    id: crypto.randomUUID(),
    baseCvId: input.cvId,
    jobPostingId: input.jobPostingId,
    tailoredData,
    gaps,
    suggestions,
    guardrailsApplied: true,
    createdAt: new Date(),
  }

  return tailoredRepo.save(tailoredCv)
}
