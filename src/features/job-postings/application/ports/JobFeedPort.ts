import type { SearchListing } from '../../ui/types/SearchListing'

/**
 * Port for fetching job listings from external sources (Adzuna, LinkedIn, etc.).
 * Stage 0: FakeJobFeedAdapter returns static mock data.
 * Stage 1.6+: AdzunaJobFeedAdapter fetches real results from the Adzuna API.
 */
export interface JobSearchCriteria {
  keywords?: string
  location?: string
  remote?: boolean
  country?: string      // ISO country code, e.g. 'es'. Defaults to 'es'.
  resultsPerPage?: number
  page?: number         // 1-based page number for pagination. Defaults to 1.
}

export interface JobFeedPort {
  search(criteria: JobSearchCriteria): Promise<SearchListing[]>
}
