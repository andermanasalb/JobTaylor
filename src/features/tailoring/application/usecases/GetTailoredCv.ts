import type { TailoredCv } from '../../domain/TailoredCv'
import type { TailoredCvRepository } from '../ports/TailoredCvRepository'

export async function getTailoredCv(
  repo: TailoredCvRepository,
  id: string,
): Promise<TailoredCv | null> {
  return repo.findById(id)
}
