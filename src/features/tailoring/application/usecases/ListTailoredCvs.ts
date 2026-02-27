import type { TailoredCv } from '../../domain/TailoredCv'
import type { TailoredCvRepository } from '../ports/TailoredCvRepository'

export async function listTailoredCvs(
  repo: TailoredCvRepository,
  filter?: { jobPostingId?: string; baseCvId?: string },
): Promise<TailoredCv[]> {
  if (filter?.jobPostingId) return repo.findByJobPostingId(filter.jobPostingId)
  if (filter?.baseCvId) return repo.findByBaseCvId(filter.baseCvId)
  return repo.findAll()
}
