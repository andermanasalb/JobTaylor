import type { SearchListing } from '../types/SearchListing'
import type { JobPosting, JobSource } from '@/features/job-postings/domain/JobPosting'

function mapSource(source: string): JobSource {
  const s = source.toLowerCase()
  if (s.includes('linkedin')) return 'linkedin'
  if (s.includes('infojobs')) return 'infojobs'
  return 'indeed'
}

/**
 * Adapts a SearchListing (mock/UI model) to a JobPosting (domain model).
 * The resulting JobPosting is NOT saved to the repo — it is used only as an
 * in-memory argument to aiClient.tailorCv().
 */
export function searchListingToJobPosting(listing: SearchListing): JobPosting {
  return {
    id: listing.id,
    title: listing.title,
    company: listing.company,
    location: listing.location,
    remote: listing.workMode === 'Remote',
    source: mapSource(listing.source),
    description: listing.description ?? '',
    requirements: {
      skills: listing.requirements,
      other: listing.niceToHave.length > 0 ? listing.niceToHave : undefined,
    },
    status: 'saved',
    createdAt: new Date(listing.postedDate),
    savedAt: new Date(),
  }
}
