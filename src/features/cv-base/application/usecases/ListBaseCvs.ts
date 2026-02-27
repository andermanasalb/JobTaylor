import type { CvRepository } from '../ports/CvRepository'
import type { BaseCv } from '../../domain/BaseCv'

export async function listBaseCvs(repo: CvRepository): Promise<BaseCv[]> {
  return repo.findAll()
}
