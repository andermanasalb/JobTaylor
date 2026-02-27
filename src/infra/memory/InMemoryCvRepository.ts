import type { CvRepository } from '../../features/cv-base/application/ports/CvRepository'
import type { BaseCv } from '../../features/cv-base/domain/BaseCv'

export class InMemoryCvRepository implements CvRepository {
  private store = new Map<string, BaseCv>()

  async save(cv: BaseCv): Promise<BaseCv> {
    this.store.set(cv.id, cv)
    return cv
  }

  async findById(id: string): Promise<BaseCv | null> {
    return this.store.get(id) ?? null
  }

  async findAll(): Promise<BaseCv[]> {
    return Array.from(this.store.values())
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
