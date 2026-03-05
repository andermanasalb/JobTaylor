// ---------------------------------------------------------------------------
// JobEnrichmentPort
// Given a job URL, fetches the full page and returns a structured summary.
// Implementations: FakeEnrichmentAdapter (tests), OllamaEnrichmentAdapter (local AI).
// ---------------------------------------------------------------------------

export interface EnrichedJob {
  description: string        // 3-4 párrafos bien escritos sobre el rol
  requirements: string[]     // requisitos imprescindibles
  niceToHave: string[]       // deseables
  techStack: string[]        // tecnologías mencionadas
  aboutCompany: string | null // párrafo sobre la empresa si hay info
}

/** 'EN' | 'ES' — mirrors AppSettings.outputLanguage */
export type EnrichmentLanguage = 'EN' | 'ES'

export interface JobEnrichmentPort {
  enrich(url: string, language?: EnrichmentLanguage): Promise<EnrichedJob>
}
