import type { HistoryRepository } from '../../features/history/application/ports/HistoryRepository'
import type { HistoryEntry } from '../../features/history/domain/HistoryEntry'

export class InMemoryHistoryRepository implements HistoryRepository {
  private store = new Map<string, HistoryEntry>()

  async save(entry: HistoryEntry): Promise<HistoryEntry> {
    this.store.set(entry.id, entry)
    return entry
  }

  async findAll(): Promise<HistoryEntry[]> {
    return Array.from(this.store.values())
  }

  async findById(id: string): Promise<HistoryEntry | null> {
    return this.store.get(id) ?? null
  }

  async findByJobId(jobId: string): Promise<HistoryEntry | null> {
    for (const entry of this.store.values()) {
      if (entry.jobId === jobId) return entry
    }
    return null
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
