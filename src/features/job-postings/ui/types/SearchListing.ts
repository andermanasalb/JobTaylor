// ---------------------------------------------------------------------------
// Search-specific view model (UI layer only).
// This is richer than the domain JobPosting — it includes fields that come
// from external job feeds (matchScore, seniority, tags, techStack, etc.)
// that don't belong in the domain entity.
// ---------------------------------------------------------------------------

export type WorkMode = 'Remote' | 'Hybrid' | 'On-site'
export type Seniority = 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Principal'

export interface SearchListing {
  id: string
  title: string
  company: string
  location: string          // ubicación libre tal como viene de Adzuna
  workMode: WorkMode
  seniority: Seniority
  postedDate: string        // ISO date string, e.g. "2026-02-20"
  source: string            // "Adzuna", "InfoJobs", etc.
  matchScore: number        // 0–100; computed by AI against base CV
  tags: string[]            // quick skill tags shown on the card
  description: string | null
  requirements: string[]
  niceToHave: string[]
  techStack: string[]
  notes: string
  url: string | null        // enlace a la oferta original
}
