import type { JobPosting, JobStatus } from '../../domain/JobPosting'

export interface JobPostingRepository {
  save(posting: JobPosting): Promise<JobPosting>
  findById(id: string): Promise<JobPosting | null>
  findAll(): Promise<JobPosting[]>
  findByStatus(status: JobStatus): Promise<JobPosting[]>
  delete(id: string): Promise<void>
}
