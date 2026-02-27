import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCvRepository } from '@/infra/memory/InMemoryCvRepository'
import { deleteBaseCv } from './DeleteBaseCv'
import { createBaseCv } from '../../domain/BaseCv'

describe('deleteBaseCv', () => {
  let repo: InMemoryCvRepository

  beforeEach(() => {
    repo = new InMemoryCvRepository()
  })

  it('deletes an existing CV', async () => {
    const cv = createBaseCv({ personalInfo: { fullName: 'Ana', email: 'a@a.com' } })
    await repo.save(cv)
    await deleteBaseCv(repo, cv.id)
    expect(await repo.findById(cv.id)).toBeNull()
  })

  it('throws if CV does not exist', async () => {
    await expect(deleteBaseCv(repo, 'nonexistent')).rejects.toThrow(
      'BaseCv with id "nonexistent" not found',
    )
  })
})
