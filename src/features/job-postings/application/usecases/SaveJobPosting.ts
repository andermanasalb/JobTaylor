import { createJobPosting, type CreateJobPostingInput, type JobPosting } from '../../domain/JobPosting'
import type { JobPostingRepository } from '../ports/JobPostingRepository'

/**
 * Upsert a job posting.
 * - If input.id is missing → create new.
 * - If input.id exists in repo → update, preserving createdAt.
 * - If input.id is provided but not found → create with that id.
 */
export async function saveJobPosting(
  repo: JobPostingRepository,
  input: CreateJobPostingInput,
): Promise<JobPosting> {
  const existing = input.id ? await repo.findById(input.id) : null

  const posting = createJobPosting(input)

  if (existing) {
    // Preserve original timestamps on update
    posting.createdAt = existing.createdAt
    posting.savedAt = existing.savedAt
  }

  return repo.save(posting)
}
