import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryTailoredCvRepository } from './InMemoryTailoredCvRepository'
import { createBaseCv } from '../../features/cv-base/domain/BaseCv'
import type { TailoredCv } from '../../features/tailoring/domain/TailoredCv'

describe('InMemoryTailoredCvRepository', () => {
  let repo: InMemoryTailoredCvRepository

  beforeEach(() => {
    repo = new InMemoryTailoredCvRepository()
  })

  const makeBaseCv = () =>
    createBaseCv({ personalInfo: { fullName: 'Ana García', email: 'ana@example.com' } })

  const makeTailored = (overrides?: { baseCvId?: string; jobPostingId?: string }): TailoredCv => {
    const base = makeBaseCv()
    return {
      id: crypto.randomUUID(),
      baseCvId: overrides?.baseCvId ?? crypto.randomUUID(),
      jobPostingId: overrides?.jobPostingId ?? crypto.randomUUID(),
      tailoredData: base,
      gaps: ['Docker', 'Kubernetes'],
      suggestions: ['Highlight cloud experience if applicable'],
      guardrailsApplied: true,
      createdAt: new Date(),
    }
  }

  it('saves and retrieves a tailored CV by id', async () => {
    const tailored = makeTailored()
    await repo.save(tailored)
    const found = await repo.findById(tailored.id)
    expect(found).toEqual(tailored)
  })

  it('returns null for unknown id', async () => {
    expect(await repo.findById('nonexistent')).toBeNull()
  })

  it('returns all tailored CVs', async () => {
    await repo.save(makeTailored())
    await repo.save(makeTailored())
    expect(await repo.findAll()).toHaveLength(2)
  })

  it('deletes a tailored CV by id', async () => {
    const tailored = makeTailored()
    await repo.save(tailored)
    await repo.delete(tailored.id)
    expect(await repo.findById(tailored.id)).toBeNull()
  })

  it('finds by jobPostingId', async () => {
    const jobPostingId = crypto.randomUUID()
    const t1 = makeTailored({ jobPostingId })
    const t2 = makeTailored({ jobPostingId })
    const t3 = makeTailored() // different job
    await repo.save(t1)
    await repo.save(t2)
    await repo.save(t3)
    const results = await repo.findByJobPostingId(jobPostingId)
    expect(results).toHaveLength(2)
    expect(results.map(r => r.id)).toContain(t1.id)
    expect(results.map(r => r.id)).toContain(t2.id)
  })

  it('finds by baseCvId', async () => {
    const baseCvId = crypto.randomUUID()
    const t1 = makeTailored({ baseCvId })
    const t2 = makeTailored() // different base CV
    await repo.save(t1)
    await repo.save(t2)
    const results = await repo.findByBaseCvId(baseCvId)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(t1.id)
  })

  it('returns empty arrays for unknown ids in findByJobPostingId and findByBaseCvId', async () => {
    expect(await repo.findByJobPostingId('unknown')).toEqual([])
    expect(await repo.findByBaseCvId('unknown')).toEqual([])
  })
})
