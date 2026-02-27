import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCvRepository } from '@/infra/memory/InMemoryCvRepository'
import { saveBaseCv } from './SaveBaseCv'

describe('saveBaseCv', () => {
  let repo: InMemoryCvRepository

  beforeEach(() => {
    repo = new InMemoryCvRepository()
  })

  const baseInput = {
    personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
  }

  it('creates a new CV when no id is provided', async () => {
    const cv = await saveBaseCv(repo, baseInput)
    expect(cv.id).toBeDefined()
    expect(cv.personalInfo.fullName).toBe('Ana García')
    const all = await repo.findAll()
    expect(all).toHaveLength(1)
  })

  it('creates with provided id when that id does not exist yet', async () => {
    const cv = await saveBaseCv(repo, { ...baseInput, id: 'new-id' })
    expect(cv.id).toBe('new-id')
    expect(await repo.findById('new-id')).not.toBeNull()
  })

  it('updates existing CV when id matches (upsert)', async () => {
    const created = await saveBaseCv(repo, baseInput)
    const updated = await saveBaseCv(repo, {
      ...baseInput,
      id: created.id,
      summary: 'Updated summary',
    })
    expect(updated.id).toBe(created.id)
    expect(updated.summary).toBe('Updated summary')
    expect(await repo.findAll()).toHaveLength(1)
  })

  it('preserves createdAt on update', async () => {
    const created = await saveBaseCv(repo, baseInput)
    await new Promise(r => setTimeout(r, 5))
    const updated = await saveBaseCv(repo, { ...baseInput, id: created.id, summary: 'x' })
    expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime())
  })

  it('updates updatedAt on update', async () => {
    const created = await saveBaseCv(repo, baseInput)
    await new Promise(r => setTimeout(r, 5))
    const updated = await saveBaseCv(repo, { ...baseInput, id: created.id, summary: 'x' })
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime())
  })

  it('throws if personalInfo is invalid', async () => {
    await expect(
      saveBaseCv(repo, { personalInfo: { fullName: '', email: 'a@b.com' } }),
    ).rejects.toThrow('BaseCv: fullName is required')
  })
})
