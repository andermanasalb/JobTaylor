import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCvRepository } from './InMemoryCvRepository'
import { createBaseCv } from '../../features/cv-base/domain/BaseCv'

describe('InMemoryCvRepository', () => {
  let repo: InMemoryCvRepository

  beforeEach(() => {
    repo = new InMemoryCvRepository()
  })

  const makeCv = (overrides?: { name?: string }) =>
    createBaseCv({
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      name: overrides?.name,
    })

  it('saves and retrieves a CV by id', async () => {
    const cv = makeCv()
    await repo.save(cv)
    const found = await repo.findById(cv.id)
    expect(found).toEqual(cv)
  })

  it('returns null for unknown id', async () => {
    const found = await repo.findById('nonexistent')
    expect(found).toBeNull()
  })

  it('returns all saved CVs', async () => {
    const cv1 = makeCv({ name: 'CV 1' })
    const cv2 = makeCv({ name: 'CV 2' })
    await repo.save(cv1)
    await repo.save(cv2)
    const all = await repo.findAll()
    expect(all).toHaveLength(2)
    expect(all.map(c => c.id)).toContain(cv1.id)
    expect(all.map(c => c.id)).toContain(cv2.id)
  })

  it('returns empty array when no CVs saved', async () => {
    const all = await repo.findAll()
    expect(all).toEqual([])
  })

  it('deletes a CV by id', async () => {
    const cv = makeCv()
    await repo.save(cv)
    await repo.delete(cv.id)
    const found = await repo.findById(cv.id)
    expect(found).toBeNull()
  })

  it('delete is a no-op for unknown id', async () => {
    await expect(repo.delete('nonexistent')).resolves.toBeUndefined()
  })

  it('updates a CV when saving with existing id (upsert)', async () => {
    const cv = makeCv()
    await repo.save(cv)
    const updated = { ...cv, summary: 'Updated summary' }
    await repo.save(updated)
    const found = await repo.findById(cv.id)
    expect(found?.summary).toBe('Updated summary')
    const all = await repo.findAll()
    expect(all).toHaveLength(1)
  })

  it('each repo instance is isolated', async () => {
    const repo2 = new InMemoryCvRepository()
    const cv = makeCv()
    await repo.save(cv)
    const found = await repo2.findById(cv.id)
    expect(found).toBeNull()
  })
})
