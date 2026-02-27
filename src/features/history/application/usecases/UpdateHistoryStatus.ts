import type { HistoryRepository } from '../ports/HistoryRepository'
import type { HistoryStatus } from '../../domain/HistoryEntry'

/**
 * Update the status of a history entry identified by jobId.
 *
 * Status progression: saved → generated → exported
 * The entry is looked up by jobId (one entry per job), its status is updated,
 * and then saved back to the repository.
 *
 * If no entry exists for the given jobId, this is a no-op (does not throw).
 */
export async function updateHistoryStatus(
  repo: HistoryRepository,
  jobId: string,
  newStatus: HistoryStatus,
): Promise<void> {
  const entry = await repo.findByJobId(jobId)
  if (!entry) return

  const updated = {
    ...entry,
    status: newStatus,
    exportedAt: newStatus === 'exported' ? new Date() : entry.exportedAt,
  }
  await repo.save(updated)
}
