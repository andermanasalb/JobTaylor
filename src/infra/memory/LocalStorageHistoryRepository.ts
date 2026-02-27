import type { HistoryRepository } from '../../features/history/application/ports/HistoryRepository'
import type { HistoryEntry, HistoryStatus } from '../../features/history/domain/HistoryEntry'

const STORAGE_KEY = 'jobtaylor-history'

/**
 * LocalStorage-backed HistoryRepository.
 *
 * Persists history entries across page refreshes.
 * Replaces InMemoryHistoryRepository for Stage 0–1.
 *
 * Dates are serialised as ISO strings and revived on read.
 * Keyed by entry.id (UUID). One entry per job (enforced by findByJobId upsert pattern).
 */
export class LocalStorageHistoryRepository implements HistoryRepository {
  private read(): Map<string, HistoryEntry> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return new Map()
      const arr: Array<{
        id: string
        jobId: string
        jobTitle: string
        company: string
        region: string
        status: HistoryStatus
        createdAt: string
        exportedAt: string | null
      }> = JSON.parse(raw)
      const map = new Map<string, HistoryEntry>()
      for (const item of arr) {
        map.set(item.id, {
          ...item,
          createdAt: new Date(item.createdAt),
          exportedAt: item.exportedAt ? new Date(item.exportedAt) : null,
        })
      }
      return map
    } catch {
      return new Map()
    }
  }

  private write(store: Map<string, HistoryEntry>): void {
    const arr = Array.from(store.values()).map(e => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      exportedAt: e.exportedAt ? e.exportedAt.toISOString() : null,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  }

  async save(entry: HistoryEntry): Promise<HistoryEntry> {
    const store = this.read()
    store.set(entry.id, entry)
    this.write(store)
    return entry
  }

  async findAll(): Promise<HistoryEntry[]> {
    return Array.from(this.read().values())
  }

  async findById(id: string): Promise<HistoryEntry | null> {
    return this.read().get(id) ?? null
  }

  async findByJobId(jobId: string): Promise<HistoryEntry | null> {
    for (const entry of this.read().values()) {
      if (entry.jobId === jobId) return entry
    }
    return null
  }

  async delete(id: string): Promise<void> {
    const store = this.read()
    store.delete(id)
    this.write(store)
  }
}
