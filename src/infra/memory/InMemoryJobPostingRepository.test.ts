import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryJobPostingRepository } from './InMemoryJobPostingRepository'
import { createJobPosting } from '../../features/job-postings/domain/JobPosting'

describe('InMemoryJobPostingRepository', () => {
  let repo: InMemoryJobPostingRepository

  beforeEach(() => {
    repo = new InMemoryJobPostingRepository()
  })

  const makePosting = (overrides?: { source?: 'linkedin' | 'infojobs'; status?: 'saved' | 'applied' }) =>
    createJobPosting({
      title: 'Frontend Developer',
      company: 'Acme Corp',
      description: 'React developer role',
      source: overrides?.source ?? 'linkedin',
      status: overrides?.status,
    })

  it('saves and retrieves a posting by id', async () => {
    const posting = makePosting()
    await repo.save(posting)
    const found = await repo.findById(posting.id)
    expect(found).toEqual(posting)
  })

  it('returns null for unknown id', async () => {
    const found = await repo.findById('nonexistent')
    expect(found).toBeNull()
  })

  it('returns all saved postings', async () => {
    const p1 = makePosting()
    const p2 = makePosting()
    await repo.save(p1)
    await repo.save(p2)
    const all = await repo.findAll()
    expect(all).toHaveLength(2)
  })

  it('returns empty array when no postings saved', async () => {
    expect(await repo.findAll()).toEqual([])
  })

  it('deletes a posting by id', async () => {
    const posting = makePosting()
    await repo.save(posting)
    await repo.delete(posting.id)
    expect(await repo.findById(posting.id)).toBeNull()
  })

  it('delete is a no-op for unknown id', async () => {
    await expect(repo.delete('nonexistent')).resolves.toBeUndefined()
  })

  it('upserts a posting when saving with existing id', async () => {
    const posting = makePosting()
    await repo.save(posting)
    const updated = { ...posting, status: 'applied' as const }
    await repo.save(updated)
    const found = await repo.findById(posting.id)
    expect(found?.status).toBe('applied')
    expect(await repo.findAll()).toHaveLength(1)
  })

  it('finds postings by status', async () => {
    const saved = makePosting({ status: 'saved' })
    const applied = makePosting({ status: 'applied' })
    await repo.save(saved)
    await repo.save(applied)
    const savedResults = await repo.findByStatus('saved')
    expect(savedResults).toHaveLength(1)
    expect(savedResults[0].id).toBe(saved.id)
    const appliedResults = await repo.findByStatus('applied')
    expect(appliedResults).toHaveLength(1)
    expect(appliedResults[0].id).toBe(applied.id)
  })

  it('returns empty array for status with no matches', async () => {
    const posting = makePosting({ status: 'saved' })
    await repo.save(posting)
    expect(await repo.findByStatus('interviewing')).toEqual([])
  })
})
