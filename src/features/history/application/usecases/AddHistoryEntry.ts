import type { HistoryRepository } from '../ports/HistoryRepository'
import type { HistoryEntry } from '../../domain/HistoryEntry'

export async function addHistoryEntry(
  repo: HistoryRepository,
  entry: HistoryEntry,
): Promise<HistoryEntry> {
  return repo.save(entry)
}
