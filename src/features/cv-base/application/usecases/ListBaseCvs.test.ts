import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCvRepository } from '@/infra/memory/InMemoryCvRepository'
import { listBaseCvs } from './ListBaseCvs'
import { createBaseCv } from '../../domain/BaseCv'

describe('listBaseCvs', () => {
  let repo: InMemoryCvRepository

  beforeEach(() => {
    repo = new InMemoryCvRepository()
  })

  it('returns empty array when no CVs exist', async () => {
    const result = await listBaseCvs(repo)
    expect(result).toEqual([])
  })

  it('returns all saved CVs', async () => {
    const cv1 = createBaseCv({ personalInfo: { fullName: 'Ana', email: 'a@a.com' }, name: 'CV 1' })
    const cv2 = createBaseCv({ personalInfo: { fullName: 'Ana', email: 'a@a.com' }, name: 'CV 2' })
    await repo.save(cv1)
    await repo.save(cv2)
    const result = await listBaseCvs(repo)
    expect(result).toHaveLength(2)
    expect(result.map(c => c.id)).toContain(cv1.id)
    expect(result.map(c => c.id)).toContain(cv2.id)
  })
})
