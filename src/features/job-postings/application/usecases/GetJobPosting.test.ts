import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryJobPostingRepository } from '@/infra/memory/InMemoryJobPostingRepository'
import { saveJobPosting } from './SaveJobPosting'
import { getJobPosting } from './GetJobPosting'

describe('getJobPosting', () => {
  let repo: InMemoryJobPostingRepository

  beforeEach(() => {
    repo = new InMemoryJobPostingRepository()
  })

  const baseInput = {
    title: 'Frontend Developer',
    company: 'Acme Corp',
    description: 'Build React apps',
    source: 'linkedin' as const,
  }

  it('returns the posting when it exists', async () => {
    const created = await saveJobPosting(repo, baseInput)
    const found = await getJobPosting(repo, created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('returns null when posting does not exist', async () => {
    const found = await getJobPosting(repo, 'nonexistent')
    expect(found).toBeNull()
  })
})
