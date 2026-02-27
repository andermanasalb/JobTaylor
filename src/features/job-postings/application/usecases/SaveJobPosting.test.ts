import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryJobPostingRepository } from '@/infra/memory/InMemoryJobPostingRepository'
import { saveJobPosting } from './SaveJobPosting'

describe('saveJobPosting', () => {
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

  it('creates a new posting when no id is provided', async () => {
    const posting = await saveJobPosting(repo, baseInput)
    expect(posting.id).toBeDefined()
    expect(posting.title).toBe('Frontend Developer')
    expect(await repo.findAll()).toHaveLength(1)
  })

  it('creates with provided id when that id does not exist yet', async () => {
    const posting = await saveJobPosting(repo, { ...baseInput, id: 'new-id' })
    expect(posting.id).toBe('new-id')
    expect(await repo.findById('new-id')).not.toBeNull()
  })

  it('updates existing posting when id matches (upsert)', async () => {
    const created = await saveJobPosting(repo, baseInput)
    const updated = await saveJobPosting(repo, {
      ...baseInput,
      id: created.id,
      title: 'Senior Frontend Developer',
    })
    expect(updated.id).toBe(created.id)
    expect(updated.title).toBe('Senior Frontend Developer')
    expect(await repo.findAll()).toHaveLength(1)
  })

  it('preserves createdAt on update', async () => {
    const created = await saveJobPosting(repo, baseInput)
    await new Promise(r => setTimeout(r, 5))
    const updated = await saveJobPosting(repo, { ...baseInput, id: created.id, title: 'x' })
    expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime())
  })

  it('throws if title is missing', async () => {
    await expect(
      saveJobPosting(repo, { ...baseInput, title: '' }),
    ).rejects.toThrow('JobPosting: title is required')
  })

  it('throws if description is missing', async () => {
    await expect(
      saveJobPosting(repo, { ...baseInput, description: '' }),
    ).rejects.toThrow('JobPosting: description is required')
  })
})
