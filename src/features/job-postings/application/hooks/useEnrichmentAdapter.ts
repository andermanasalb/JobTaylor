import { useMemo } from 'react'
import { GeminiEnrichmentAdapter } from '@/infra/enrichment/GeminiEnrichmentAdapter'
import { OllamaEnrichmentAdapter } from '@/infra/enrichment/OllamaEnrichmentAdapter'
import { FakeEnrichmentAdapter } from '@/infra/enrichment/FakeEnrichmentAdapter'
import type { JobEnrichmentPort } from '../ports/JobEnrichmentPort'
import type { AiMode } from '@/features/settings/domain/AppSettings'

/**
 * Returns the correct enrichment adapter based on the current aiMode setting.
 * Rebuilds the adapter whenever aiMode changes so the composition root's
 * frozen startup value does not stale.
 */
export function useEnrichmentAdapter(aiMode: AiMode): JobEnrichmentPort {
  return useMemo(() => {
    if (aiMode === 'cloud') return new GeminiEnrichmentAdapter()
    if (aiMode === 'local') return new OllamaEnrichmentAdapter()
    return new FakeEnrichmentAdapter()
  }, [aiMode])
}
