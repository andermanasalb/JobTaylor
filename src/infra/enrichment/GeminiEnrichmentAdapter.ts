import type { JobEnrichmentPort, EnrichedJob, EnrichmentLanguage } from '../../features/job-postings/application/ports/JobEnrichmentPort'

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'

/**
 * Calls the local proxy /enrich endpoint with provider='gemini'.
 * The proxy uses Tavily Extract to fetch the job page content and
 * Gemini to produce the structured EnrichedJob JSON.
 */
export class GeminiEnrichmentAdapter implements JobEnrichmentPort {
  async enrich(url: string, language?: EnrichmentLanguage): Promise<EnrichedJob> {
    const res = await fetch(`${PROXY_URL}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, provider: 'gemini', language }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error ?? `Proxy error ${res.status}`)
    }

    const data = await res.json() as EnrichedJob
    return data
  }
}
