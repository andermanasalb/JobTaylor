import type { CvRepository } from '../../features/cv-base/application/ports/CvRepository'
import type { BaseCv } from '../../features/cv-base/domain/BaseCv'

const STORAGE_KEY = 'jobtaylor-cvs'

/**
 * LocalStorage-backed CvRepository.
 *
 * Persists base CVs across page refreshes (Stage 0 / Stage 1).
 * Replaces InMemoryCvRepository so E2E flows that navigate between pages
 * (e.g. /cv → /search → /history) work without losing CV data.
 *
 * Dates are serialised as ISO strings and revived on read.
 */
export class LocalStorageCvRepository implements CvRepository {
  private read(): Map<string, BaseCv> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return new Map()
      const arr: Array<Record<string, unknown>> = JSON.parse(raw)
      const map = new Map<string, BaseCv>()
      for (const item of arr) {
        const cv = {
          ...item,
          createdAt: item['createdAt'] ? new Date(item['createdAt'] as string) : new Date(),
          updatedAt: item['updatedAt'] ? new Date(item['updatedAt'] as string) : new Date(),
        } as BaseCv
        map.set(cv.id, cv)
      }
      return map
    } catch {
      return new Map()
    }
  }

  private write(store: Map<string, BaseCv>): void {
    const arr = Array.from(store.values()).map(cv => ({
      ...cv,
      createdAt: cv.createdAt instanceof Date ? cv.createdAt.toISOString() : cv.createdAt,
      updatedAt: cv.updatedAt instanceof Date ? cv.updatedAt.toISOString() : cv.updatedAt,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  }

  async save(cv: BaseCv): Promise<BaseCv> {
    const store = this.read()
    store.set(cv.id, cv)
    this.write(store)
    return cv
  }

  async findById(id: string): Promise<BaseCv | null> {
    return this.read().get(id) ?? null
  }

  async findAll(): Promise<BaseCv[]> {
    return Array.from(this.read().values())
  }

  async delete(id: string): Promise<void> {
    const store = this.read()
    store.delete(id)
    this.write(store)
  }
}
