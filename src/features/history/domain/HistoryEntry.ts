// ---------------------------------------------------------------------------
// History domain entity.
// Pure domain — no React, no network, no external imports.
// ---------------------------------------------------------------------------

export type HistoryStatus = 'saved' | 'generated' | 'exported'

export interface HistoryEntry {
  id: string
  jobId: string
  jobTitle: string
  company: string
  region: string
  status: HistoryStatus
  createdAt: Date
  exportedAt: Date | null
}

export function createHistoryEntry(params: {
  jobId: string
  jobTitle: string
  company: string
  region: string
  status?: HistoryStatus
}): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    jobId: params.jobId,
    jobTitle: params.jobTitle,
    company: params.company,
    region: params.region,
    status: params.status ?? 'saved',
    createdAt: new Date(),
    exportedAt: null,
  }
}
