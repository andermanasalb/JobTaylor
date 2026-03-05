import type { ScoringPort, ScoreResult } from './ScoringPort'

/**
 * Deterministic fake for unit tests.
 * Always returns a fixed score of 72.
 */
export class FakeScoringAdapter implements ScoringPort {
  async score(_cvPreview: string, _jobDescription: string): Promise<ScoreResult> {
    return { score: 72 }
  }
}
