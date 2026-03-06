import { LocalStorageCvRepository } from '../infra/memory/LocalStorageCvRepository'
import { InMemoryJobPostingRepository } from '../infra/memory/InMemoryJobPostingRepository'
import { InMemoryTailoredCvRepository } from '../infra/memory/InMemoryTailoredCvRepository'
import { LocalStorageHistoryRepository } from '../infra/memory/LocalStorageHistoryRepository'
import { FakeAiClient } from '../infra/ai/FakeAiClient'
import { FakeJobFeedAdapter } from '../infra/job-feed/FakeJobFeedAdapter'
import { FakeEnrichmentAdapter } from '../infra/enrichment/FakeEnrichmentAdapter'
import { GeminiEnrichmentAdapter } from '../infra/enrichment/GeminiEnrichmentAdapter'
import { FakeScoringAdapter } from '../infra/scoring/FakeScoringAdapter'
import { GeminiScoringAdapter } from '../infra/scoring/GeminiScoringAdapter'
import type { CvRepository } from '../features/cv-base/application/ports/CvRepository'
import type { JobPostingRepository } from '../features/job-postings/application/ports/JobPostingRepository'
import type { TailoredCvRepository } from '../features/tailoring/application/ports/TailoredCvRepository'
import type { AiClient } from '../features/tailoring/application/ports/AiClient'
import type { HistoryRepository } from '../features/history/application/ports/HistoryRepository'
import type { AuthRepository } from '../features/auth/application/ports/AuthRepository'
import type { JobFeedPort } from '../features/job-postings/application/ports/JobFeedPort'
import type { JobEnrichmentPort } from '../features/job-postings/application/ports/JobEnrichmentPort'
import type { ScoringPort } from '../infra/scoring/ScoringPort'

export interface AppDependencies {
  cvRepository: CvRepository
  jobPostingRepository: JobPostingRepository
  tailoredCvRepository: TailoredCvRepository
  aiClient: AiClient
  historyRepository: HistoryRepository
  authRepository: AuthRepository
  jobFeedPort: JobFeedPort
  jobEnrichmentPort: JobEnrichmentPort
  scoringPort: ScoringPort
}

const useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true'
const adzunaAppId = import.meta.env.VITE_ADZUNA_APP_ID as string | undefined
const adzunaAppKey = import.meta.env.VITE_ADZUNA_APP_KEY as string | undefined

/**
 * Composition root.
 *
 * Stage 0 (default): VITE_USE_SUPABASE is unset or false → in-memory repos.
 * Stage 1+:          VITE_USE_SUPABASE=true in .env.local  → Supabase repos.
 *
 * Supabase modules are imported dynamically so the Supabase client is never
 * instantiated (and never throws for missing env vars) in Stage 0.
 *
 * Domain and application layers never import from this file.
 *
 * Note: Stage 0 uses LocalStorageHistoryRepository. Stage 1+ uses SupabaseHistoryRepository.
 */
async function buildDeps(): Promise<AppDependencies> {
  if (useSupabase) {
    const [
      { SupabaseCvRepository },
      { SupabaseJobPostingRepository },
      { SupabaseTailoredCvRepository },
      { SupabaseAuthRepository },
      { SupabaseHistoryRepository },
      { AdzunaJobFeedAdapter },
    ] = await Promise.all([
      import('../infra/supabase/SupabaseCvRepository'),
      import('../infra/supabase/SupabaseJobPostingRepository'),
      import('../infra/supabase/SupabaseTailoredCvRepository'),
      import('../infra/supabase/SupabaseAuthRepository'),
      import('../infra/supabase/SupabaseHistoryRepository'),
      import('../infra/job-feed/AdzunaJobFeedAdapter'),
    ])

    return {
      cvRepository: new SupabaseCvRepository(),
      jobPostingRepository: new SupabaseJobPostingRepository(),
      tailoredCvRepository: new SupabaseTailoredCvRepository(),
      aiClient: new FakeAiClient(),
      historyRepository: new SupabaseHistoryRepository(),
      authRepository: new SupabaseAuthRepository(),
      jobFeedPort: adzunaAppId && adzunaAppKey
        ? new AdzunaJobFeedAdapter(adzunaAppId, adzunaAppKey)
        : new FakeJobFeedAdapter(),
      jobEnrichmentPort: new GeminiEnrichmentAdapter(),
      scoringPort: new GeminiScoringAdapter(),
    }
  }

  // Stage 0: no real auth — provide a no-op stub so the type is satisfied
  const { FakeAuthRepository } = await import('../infra/memory/FakeAuthRepository')
  return {
    cvRepository: new LocalStorageCvRepository(),
    jobPostingRepository: new InMemoryJobPostingRepository(),
    tailoredCvRepository: new InMemoryTailoredCvRepository(),
    aiClient: new FakeAiClient(),
    historyRepository: new LocalStorageHistoryRepository(),
    authRepository: new FakeAuthRepository(),
    jobFeedPort: new FakeJobFeedAdapter(),
    jobEnrichmentPort: new FakeEnrichmentAdapter(),
    scoringPort: new FakeScoringAdapter(),
  }
}

export const deps: AppDependencies = await buildDeps()
