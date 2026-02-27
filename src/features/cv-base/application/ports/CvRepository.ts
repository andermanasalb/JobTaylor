import type { BaseCv } from '../../domain/BaseCv'

export interface CvRepository {
  save(cv: BaseCv): Promise<BaseCv>
  findById(id: string): Promise<BaseCv | null>
  findAll(): Promise<BaseCv[]>
  delete(id: string): Promise<void>
}
