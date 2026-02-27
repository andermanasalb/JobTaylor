import type { JobPostingRepository } from '../ports/JobPostingRepository'

export async function deleteJobPosting(repo: JobPostingRepository, id: string): Promise<void> {
  return repo.delete(id)
}
