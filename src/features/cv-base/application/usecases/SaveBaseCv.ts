import type { CvRepository } from '../ports/CvRepository'
import { createBaseCv, type BaseCv, type CreateBaseCvInput } from '../../domain/BaseCv'

export async function saveBaseCv(repo: CvRepository, input: CreateBaseCvInput): Promise<BaseCv> {
  if (input.id) {
    const existing = await repo.findById(input.id)
    if (existing) {
      const updated: BaseCv = {
        id: existing.id,
        name: input.name ?? existing.name,
        personalInfo: input.personalInfo,
        summary: input.summary ?? '',
        experience: input.experience ?? [],
        education: input.education ?? [],
        skills: input.skills ?? [],
        languages: input.languages ?? [],
        links: input.links ?? [],
        createdAt: existing.createdAt, // preserve
        updatedAt: new Date(),
      }
      return repo.save(updated)
    }
  }
  return repo.save(createBaseCv(input))
}
