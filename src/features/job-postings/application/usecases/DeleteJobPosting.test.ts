import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryJobPostingRepository } from '@/infra/memory/InMemoryJobPostingRepository'
import { saveJobPosting } from './SaveJobPosting'
import { deleteJobPosting } from './DeleteJobPosting'

describe('deleteJobPosting', () => {
  let repo: InMemoryJobPostingRepository

  beforeEach(() => {
    repo = new InMemoryJobPostingRepository()
  })

  it('removes an existing posting', async () => {
    const created = await saveJobPosting(repo, {
      title: 'Dev',
      company: 'X',
      description: 'desc',
      source: 'linkedin',
    })
    await deleteJobPosting(repo, created.id)
    expect(await repo.findAll()).toHaveLength(0)
  })

  it('does not throw when deleting a non-existent id', async () => {
    await expect(deleteJobPosting(repo, 'ghost-id')).resolves.toBeUndefined()
  })
})
