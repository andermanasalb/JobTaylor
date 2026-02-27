import type { TailoredCv } from '../../domain/TailoredCv'

export interface TailoredCvRepository {
  save(cv: TailoredCv): Promise<TailoredCv>
  findById(id: string): Promise<TailoredCv | null>
  findByJobPostingId(jobPostingId: string): Promise<TailoredCv[]>
  findByBaseCvId(baseCvId: string): Promise<TailoredCv[]>
  findAll(): Promise<TailoredCv[]>
  delete(id: string): Promise<void>
}
