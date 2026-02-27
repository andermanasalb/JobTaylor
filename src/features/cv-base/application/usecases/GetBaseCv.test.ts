import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCvRepository } from '@/infra/memory/InMemoryCvRepository'
import { getBaseCv } from './GetBaseCv'
import { createBaseCv } from '../../domain/BaseCv'

describe('getBaseCv', () => {
  let repo: InMemoryCvRepository

  beforeEach(() => {
    repo = new InMemoryCvRepository()
  })

  it('returns the CV when found', async () => {
    const cv = createBaseCv({ personalInfo: { fullName: 'Ana García', email: 'ana@example.com' } })
    await repo.save(cv)
    const found = await getBaseCv(repo, cv.id)
    expect(found).toEqual(cv)
  })

  it('returns null when not found', async () => {
    const found = await getBaseCv(repo, 'nonexistent')
    expect(found).toBeNull()
  })
})
