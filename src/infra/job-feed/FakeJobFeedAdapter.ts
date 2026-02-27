import type { JobFeedPort, JobSearchCriteria } from '../../features/job-postings/application/ports/JobFeedPort'
import type { SearchListing } from '../../features/job-postings/ui/types/SearchListing'
import { mockListings } from '../../features/job-postings/ui/mock/searchMock'

/**
 * Fake implementation of JobFeedPort for Stage 0 and unit tests.
 * Returns the static mock listings, optionally filtered by keywords/location.
 * No network calls.
 */
export class FakeJobFeedAdapter implements JobFeedPort {
  async search(criteria: JobSearchCriteria): Promise<SearchListing[]> {
    let results = [...mockListings]

    if (criteria.keywords) {
      const q = criteria.keywords.toLowerCase()
      results = results.filter(
        j =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.tags.some(t => t.toLowerCase().includes(q)),
      )
    }

    if (criteria.location) {
      const loc = criteria.location.toLowerCase()
      results = results.filter(j => j.location.toLowerCase().includes(loc))
    }

    if (criteria.remote) {
      results = results.filter(j => j.workMode === 'Remote')
    }

    return results
  }
}
