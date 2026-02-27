import type { JobPosting, JobSource } from '../../domain/JobPosting'

/**
 * Port for fetching job postings from external sources (LinkedIn, InfoJobs, Indeed, etc.).
 * Stage 0: no implementation — jobs are added manually.
 * Stage 1+: implement adapters per portal behind this interface.
 */
export interface JobSearchCriteria {
  keywords?: string[]
  location?: string
  remote?: boolean
  salaryMin?: number
  source?: JobSource
}

export interface JobFeedPort {
  search(criteria: JobSearchCriteria): Promise<JobPosting[]>
}
