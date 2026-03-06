import type { JobFeedPort, JobSearchCriteria } from '../../features/job-postings/application/ports/JobFeedPort'
import type { SearchListing, WorkMode, Seniority } from '../../features/job-postings/ui/types/SearchListing'

// ---------------------------------------------------------------------------
// Adzuna API response types (subset of what we use)
// ---------------------------------------------------------------------------
interface AdzunaLocation {
  display_name: string
  area?: string[]
}

interface AdzunaCompany {
  display_name: string
}

interface AdzunaJob {
  id: string
  title: string
  description: string
  created: string
  redirect_url: string
  location?: AdzunaLocation
  company?: AdzunaCompany
  salary_min?: number
  salary_max?: number
  contract_time?: 'full_time' | 'part_time'
  contract_type?: 'permanent' | 'contract'
}

interface AdzunaSearchResponse {
  count: number
  results: AdzunaJob[]
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Infers WorkMode from contract_time and location text.
 * Adzuna does not expose remote/hybrid explicitly — we use heuristics.
 */
function inferWorkMode(job: AdzunaJob): WorkMode {
  const desc = (job.description ?? '').toLowerCase()
  const title = (job.title ?? '').toLowerCase()
  if (desc.includes('remote') || desc.includes('remoto') || title.includes('remote')) return 'Remote'
  if (desc.includes('hybrid') || desc.includes('híbrido') || desc.includes('hibrido')) return 'Hybrid'
  return 'On-site'
}

/**
 * Infers Seniority from the job title.
 * Rough heuristic — good enough for display purposes.
 */
function inferSeniority(title: string): Seniority {
  const t = title.toLowerCase()
  if (t.includes('lead') || t.includes('principal') || t.includes('staff')) return 'Lead'
  if (t.includes('senior') || t.includes('sr.') || t.includes(' sr ')) return 'Senior'
  if (t.includes('junior') || t.includes('jr.') || t.includes(' jr ') || t.includes('trainee') || t.includes('grad')) return 'Junior'
  return 'Mid'
}

/**
 * Extracts simple skill tags from the description (first 500 chars is all Adzuna gives us).
 * Looks for common tech keywords to populate the tag chips on the card.
 */
const KNOWN_TAGS = [
  'TypeScript', 'JavaScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java',
  'Go', 'Rust', 'C++', 'C#', '.NET', 'PHP', 'Ruby', 'Swift', 'Kotlin',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'GraphQL', 'REST', 'gRPC', 'Kafka', 'RabbitMQ',
  'Git', 'CI/CD', 'DevOps', 'Agile', 'Scrum',
  'Machine Learning', 'AI', 'Data Science', 'Spark', 'Hadoop',
]

function extractTags(text: string): string[] {
  const found: string[] = []
  const lower = text.toLowerCase()
  for (const tag of KNOWN_TAGS) {
    if (lower.includes(tag.toLowerCase()) && found.length < 4) {
      found.push(tag)
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class AdzunaJobFeedAdapter implements JobFeedPort {
  private readonly appId: string
  private readonly appKey: string
  private readonly baseUrl = 'https://api.adzuna.com/v1/api'

  constructor(appId: string, appKey: string) {
    this.appId = appId
    this.appKey = appKey
  }

  async search(criteria: JobSearchCriteria): Promise<SearchListing[]> {
    const country = criteria.country ?? 'es'
    const resultsPerPage = criteria.resultsPerPage ?? 20
    const page = criteria.page ?? 1

    const params = new URLSearchParams({
      app_id: this.appId,
      app_key: this.appKey,
      results_per_page: String(resultsPerPage),
      sort_by: 'date',
    })

    if (criteria.keywords) {
      params.set('title_only', criteria.keywords)
    }
    if (criteria.location) params.set('where', criteria.location)
    if (criteria.remote) params.set('what_or', 'remote remoto')

    const url = `${this.baseUrl}/jobs/${country}/search/${page}?${params.toString()}`

    const response = await fetch(url)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Adzuna API error ${response.status}: ${text}`)
    }

    const data: AdzunaSearchResponse = await response.json()

    return data.results.map((job): SearchListing => {
      const locationName = job.location?.display_name ?? ''
      const postedDate = job.created
        ? new Date(job.created).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)

      return {
        id: job.id,
        title: job.title,
        company: job.company?.display_name ?? 'Unknown',
        location: locationName,
        workMode: inferWorkMode(job),
        seniority: inferSeniority(job.title),
        postedDate,
        source: 'Adzuna',
        matchScore: 0,           // no AI scoring yet — will be computed in Stage 1.6 AI step
        tags: extractTags(job.description ?? ''),
        description: job.description ?? null,
        requirements: [],        // Adzuna doesn't provide structured requirements
        niceToHave: [],
        techStack: extractTags(job.description ?? ''),
        notes: job.redirect_url ? `Ver oferta: ${job.redirect_url}` : '',
        url: job.redirect_url ?? null,
      }
    })
  }
}
