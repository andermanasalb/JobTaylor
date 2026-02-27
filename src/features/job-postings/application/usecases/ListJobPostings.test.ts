import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryJobPostingRepository } from '@/infra/memory/InMemoryJobPostingRepository'
import { saveJobPosting } from './SaveJobPosting'
import { listJobPostings } from './ListJobPostings'

describe('listJobPostings', () => {
  let repo: InMemoryJobPostingRepository

  beforeEach(() => {
    repo = new InMemoryJobPostingRepository()
  })

  it('returns empty array when no postings', async () => {
    expect(await listJobPostings(repo)).toEqual([])
  })

  it('returns all saved postings', async () => {
    await saveJobPosting(repo, { title: 'Dev A', company: 'X', description: 'desc', source: 'linkedin' })
    await saveJobPosting(repo, { title: 'Dev B', company: 'Y', description: 'desc', source: 'indeed' })
    const all = await listJobPostings(repo)
    expect(all).toHaveLength(2)
  })
})
