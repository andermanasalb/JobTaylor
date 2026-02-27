import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCvRepository } from '@/infra/memory/InMemoryCvRepository'
import { InMemoryJobPostingRepository } from '@/infra/memory/InMemoryJobPostingRepository'
import { InMemoryTailoredCvRepository } from '@/infra/memory/InMemoryTailoredCvRepository'
import { FakeAiClient } from '@/infra/ai/FakeAiClient'
import { saveBaseCv } from '@/features/cv-base/application/usecases/SaveBaseCv'
import { saveJobPosting } from '@/features/job-postings/application/usecases/SaveJobPosting'
import { generateTailoredCv } from './GenerateTailoredCv'

describe('generateTailoredCv', () => {
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

  it('generates and persists a tailored CV', async () => {
    const cv = await saveBaseCv(cvRepo, {
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      skills: [{ name: 'React' }, { name: 'TypeScript' }],
    })
    const job = await saveJobPosting(jobRepo, {
      title: 'Frontend Developer',
      company: 'Acme',
      description: 'We need React and GraphQL skills',
      source: 'linkedin',
      requirements: { skills: ['React', 'GraphQL'] },
    })

    const result = await generateTailoredCv(
      { cvRepo, jobRepo, tailoredRepo, aiClient },
      { cvId: cv.id, jobPostingId: job.id },
    )

    expect(result.baseCvId).toBe(cv.id)
    expect(result.jobPostingId).toBe(job.id)
    expect(result.guardrailsApplied).toBe(true)
    expect(result.id).toBeDefined()

    // Persisted
    const saved = await tailoredRepo.findById(result.id)
    expect(saved).not.toBeNull()
  })

  it('identifies gaps between job requirements and CV skills', async () => {
    const cv = await saveBaseCv(cvRepo, {
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      skills: [{ name: 'React' }],
    })
    const job = await saveJobPosting(jobRepo, {
      title: 'Frontend Developer',
      company: 'Acme',
      description: 'Need React and GraphQL',
      source: 'linkedin',
      requirements: { skills: ['React', 'GraphQL'] },
    })

    const result = await generateTailoredCv(
      { cvRepo, jobRepo, tailoredRepo, aiClient },
      { cvId: cv.id, jobPostingId: job.id },
    )

    expect(result.gaps).toContain('GraphQL')
    expect(result.gaps).not.toContain('React')
  })

  it('does not invent content — tailoredData has same experience as base CV', async () => {
    const cv = await saveBaseCv(cvRepo, {
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      experience: [{
        id: 'exp-1',
        title: 'Developer',
        company: 'OldCorp',
        startDate: '2020-01',
        description: ['Built things'],
      }],
    })
    const job = await saveJobPosting(jobRepo, {
      title: 'Senior Dev',
      company: 'NewCorp',
      description: 'Senior role',
      source: 'indeed',
    })

    const result = await generateTailoredCv(
      { cvRepo, jobRepo, tailoredRepo, aiClient },
      { cvId: cv.id, jobPostingId: job.id },
    )

    expect(result.tailoredData.experience).toHaveLength(1)
    expect(result.tailoredData.experience[0].company).toBe('OldCorp')
  })

  it('throws if CV does not exist', async () => {
    const job = await saveJobPosting(jobRepo, {
      title: 'Dev',
      company: 'X',
      description: 'desc',
      source: 'linkedin',
    })

    await expect(
      generateTailoredCv(
        { cvRepo, jobRepo, tailoredRepo, aiClient },
        { cvId: 'nonexistent', jobPostingId: job.id },
      ),
    ).rejects.toThrow('CV not found')
  })

  it('throws if job posting does not exist', async () => {
    const cv = await saveBaseCv(cvRepo, {
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
    })

    await expect(
      generateTailoredCv(
        { cvRepo, jobRepo, tailoredRepo, aiClient },
        { cvId: cv.id, jobPostingId: 'nonexistent' },
      ),
    ).rejects.toThrow('Job posting not found')
  })
})
