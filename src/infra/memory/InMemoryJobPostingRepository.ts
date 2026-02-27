import type { JobPostingRepository } from '../../features/job-postings/application/ports/JobPostingRepository'
import type { JobPosting, JobStatus } from '../../features/job-postings/domain/JobPosting'

export class InMemoryJobPostingRepository implements JobPostingRepository {
  private store = new Map<string, JobPosting>()

  async save(posting: JobPosting): Promise<JobPosting> {
    this.store.set(posting.id, posting)
    return posting
  }

  async findById(id: string): Promise<JobPosting | null> {
    return this.store.get(id) ?? null
  }

  async findAll(): Promise<JobPosting[]> {
    return Array.from(this.store.values())
  }

  async findByStatus(status: JobStatus): Promise<JobPosting[]> {
    return Array.from(this.store.values()).filter(p => p.status === status)
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
