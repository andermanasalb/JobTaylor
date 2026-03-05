// ---------------------------------------------------------------------------
// ScoringPort
// Given a plain-text CV preview and a job description, returns a match score.
// Implementations: FakeScoringAdapter (tests), OllamaScoringAdapter (local AI),
//                  GeminiScoringAdapter (cloud AI).
// ---------------------------------------------------------------------------

export interface ScoreResult {
  score: number // integer 0-100
}

export interface ScoringPort {
  score(cvPreview: string, jobDescription: string): Promise<ScoreResult>
}
