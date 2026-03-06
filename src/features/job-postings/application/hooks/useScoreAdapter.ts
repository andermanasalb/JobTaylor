import { useMemo } from 'react'
import { GeminiScoringAdapter } from '@/infra/scoring/GeminiScoringAdapter'
import type { ScoringPort } from '@/infra/scoring/ScoringPort'

/**
 * Returns the Gemini scoring adapter.
 * Hook kept for backwards-compatible API with SearchPage.
 */
export function useScoreAdapter(): ScoringPort {
  return useMemo(() => new GeminiScoringAdapter(), [])
}
