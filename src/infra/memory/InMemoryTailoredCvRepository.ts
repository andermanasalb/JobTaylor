import type { TailoredCvRepository } from '../../features/tailoring/application/ports/TailoredCvRepository'
import type { TailoredCv } from '../../features/tailoring/domain/TailoredCv'

export class InMemoryTailoredCvRepository implements TailoredCvRepository {
  private store = new Map<string, TailoredCv>()

  async save(cv: TailoredCv): Promise<TailoredCv> {
    this.store.set(cv.id, cv)
    return cv
  }

  async findById(id: string): Promise<TailoredCv | null> {
    return this.store.get(id) ?? null
  }

  async findByJobPostingId(jobPostingId: string): Promise<TailoredCv[]> {
    return Array.from(this.store.values()).filter(cv => cv.jobPostingId === jobPostingId)
  }

  async findByBaseCvId(baseCvId: string): Promise<TailoredCv[]> {
    return Array.from(this.store.values()).filter(cv => cv.baseCvId === baseCvId)
  }

  async findAll(): Promise<TailoredCv[]> {
    return Array.from(this.store.values())
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
