import type { CvRepository } from '../ports/CvRepository'
import type { BaseCv } from '../../domain/BaseCv'

export async function getBaseCv(repo: CvRepository, id: string): Promise<BaseCv | null> {
  return repo.findById(id)
}
