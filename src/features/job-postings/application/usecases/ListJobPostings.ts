import type { JobPosting } from '../../domain/JobPosting'
import type { JobPostingRepository } from '../ports/JobPostingRepository'

export async function listJobPostings(repo: JobPostingRepository): Promise<JobPosting[]> {
  return repo.findAll()
}
