import { useMemo } from 'react'
import { GeminiEnrichmentAdapter } from '@/infra/enrichment/GeminiEnrichmentAdapter'
import type { JobEnrichmentPort } from '../ports/JobEnrichmentPort'

/**
 * Returns the Gemini enrichment adapter.
 * Hook kept for backwards-compatible API with SearchPage.
 */
export function useEnrichmentAdapter(): JobEnrichmentPort {
  return useMemo(() => new GeminiEnrichmentAdapter(), [])
}
