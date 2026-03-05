import { useMemo } from 'react'
import { GeminiScoringAdapter } from '@/infra/scoring/GeminiScoringAdapter'
import { OllamaScoringAdapter } from '@/infra/scoring/OllamaScoringAdapter'
import { FakeScoringAdapter } from '@/infra/scoring/FakeScoringAdapter'
import type { ScoringPort } from '@/infra/scoring/ScoringPort'
import type { AiMode } from '@/features/settings/domain/AppSettings'

/**
 * Returns the correct scoring adapter based on the current aiMode setting.
 * Rebuilds the adapter whenever aiMode changes so it stays reactive.
 */
export function useScoreAdapter(aiMode: AiMode): ScoringPort {
  return useMemo(() => {
    if (aiMode === 'cloud') return new GeminiScoringAdapter()
    if (aiMode === 'local') return new OllamaScoringAdapter()
    return new FakeScoringAdapter()
  }, [aiMode])
}
