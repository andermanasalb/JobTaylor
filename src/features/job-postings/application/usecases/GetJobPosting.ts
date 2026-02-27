import type { JobPosting } from '../../domain/JobPosting'
import type { JobPostingRepository } from '../ports/JobPostingRepository'

export async function getJobPosting(
  repo: JobPostingRepository,
  id: string,
): Promise<JobPosting | null> {
  return repo.findById(id)
}
