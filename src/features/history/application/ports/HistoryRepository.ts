import type { HistoryEntry } from '../../domain/HistoryEntry'

export interface HistoryRepository {
  save(entry: HistoryEntry): Promise<HistoryEntry>
  findAll(): Promise<HistoryEntry[]>
  findById(id: string): Promise<HistoryEntry | null>
  /** Returns the single entry for a given job posting, or null if none. */
  findByJobId(jobId: string): Promise<HistoryEntry | null>
  delete(id: string): Promise<void>
}
