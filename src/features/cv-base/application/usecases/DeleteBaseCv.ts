import type { CvRepository } from '../ports/CvRepository'

export async function deleteBaseCv(repo: CvRepository, id: string): Promise<void> {
  const existing = await repo.findById(id)
  if (!existing) throw new Error(`BaseCv with id "${id}" not found`)
  return repo.delete(id)
}
