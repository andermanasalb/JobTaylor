import type { HistoryRepository } from '../ports/HistoryRepository'

/**
 * Removes a history entry by jobId, but only if its status is still 'saved'.
 * Entries with status 'generated' or 'exported' are kept permanently.
 */
export async function removeHistoryEntry(
  repo: HistoryRepository,
  jobId: string,
): Promise<void> {
  const existing = await repo.findByJobId(jobId)
  if (existing && existing.status === 'saved') {
    await repo.delete(existing.id)
  }
}
