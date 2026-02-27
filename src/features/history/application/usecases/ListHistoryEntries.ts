import type { HistoryRepository } from '../ports/HistoryRepository'
import type { HistoryEntry } from '../../domain/HistoryEntry'

export async function listHistoryEntries(
  repo: HistoryRepository,
): Promise<HistoryEntry[]> {
  const entries = await repo.findAll()
  return entries.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
}
