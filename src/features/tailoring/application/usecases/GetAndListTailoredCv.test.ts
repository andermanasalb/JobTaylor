import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCvRepository } from '@/infra/memory/InMemoryCvRepository'
import { InMemoryJobPostingRepository } from '@/infra/memory/InMemoryJobPostingRepository'
import { InMemoryTailoredCvRepository } from '@/infra/memory/InMemoryTailoredCvRepository'
import { FakeAiClient } from '@/infra/ai/FakeAiClient'
import { saveBaseCv } from '@/features/cv-base/application/usecases/SaveBaseCv'
import { saveJobPosting } from '@/features/job-postings/application/usecases/SaveJobPosting'
import { generateTailoredCv } from './GenerateTailoredCv'
import { getTailoredCv } from './GetTailoredCv'
import { listTailoredCvs } from './ListTailoredCvs'

describe('getTailoredCv', () => {
  let cvRepo: InMemoryCvRepository
  let jobRepo: InMemoryJobPostingRepository
  let tailoredRepo: InMemoryTailoredCvRepository
  let aiClient: FakeAiClient

  beforeEach(() => {
    cvRepo = new InMemoryCvRepository()
    jobRepo = new InMemoryJobPostingRepository()
    tailoredRepo = new InMemoryTailoredCvRepository()
    aiClient = new FakeAiClient()
  })

  async function createPair() {
    const cv = await saveBaseCv(cvRepo, {
      personalInfo: { fullName: 'Ana', email: 'ana@x.com' },
    })
    const job = await saveJobPosting(jobRepo, {
      title: 'Dev',
      company: 'X',
      description: 'desc',
      source: 'linkedin',
    })
    return { cv, job }
  }

  it('returns the tailored CV when it exists', async () => {
    const { cv, job } = await createPair()
    const generated = await generateTailoredCv(
      { cvRepo, jobRepo, tailoredRepo, aiClient },
      { cvId: cv.id, jobPostingId: job.id },
    )
    const found = await getTailoredCv(tailoredRepo, generated.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(generated.id)
  })

  it('returns null when not found', async () => {
    expect(await getTailoredCv(tailoredRepo, 'nope')).toBeNull()
  })
})

describe('listTailoredCvs', () => {
  let cvRepo: InMemoryCvRepository
  let jobRepo: InMemoryJobPostingRepository
  let tailoredRepo: InMemoryTailoredCvRepository
  let aiClient: FakeAiClient

  beforeEach(() => {
    cvRepo = new InMemoryCvRepository()
    jobRepo = new InMemoryJobPostingRepository()
    tailoredRepo = new InMemoryTailoredCvRepository()
    aiClient = new FakeAiClient()
  })

  it('returns empty array when no tailored CVs', async () => {
    expect(await listTailoredCvs(tailoredRepo)).toEqual([])
  })

  it('filters by jobPostingId', async () => {
    const cv = await saveBaseCv(cvRepo, {
      personalInfo: { fullName: 'Ana', email: 'ana@x.com' },
    })
    const job1 = await saveJobPosting(jobRepo, {
      title: 'Dev A', company: 'X', description: 'desc', source: 'linkedin',
    })
    const job2 = await saveJobPosting(jobRepo, {
      title: 'Dev B', company: 'Y', description: 'desc', source: 'indeed',
    })
    const deps = { cvRepo, jobRepo, tailoredRepo, aiClient }
    await generateTailoredCv(deps, { cvId: cv.id, jobPostingId: job1.id })
    await generateTailoredCv(deps, { cvId: cv.id, jobPostingId: job2.id })

    const results = await listTailoredCvs(tailoredRepo, { jobPostingId: job1.id })
    expect(results).toHaveLength(1)
    expect(results[0].jobPostingId).toBe(job1.id)
  })
})
