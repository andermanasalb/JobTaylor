import { supabase } from './client'
import type { HistoryRepository } from '@/features/history/application/ports/HistoryRepository'
import type { HistoryEntry, HistoryStatus } from '@/features/history/domain/HistoryEntry'

// DB row shape
interface HistoryEntryRow {
  id: string
  user_id: string
  job_id: string
  job_title: string
  company: string
  region: string
  job_url: string | null
  status: HistoryStatus
  created_at: string
  exported_at: string | null
}

function rowToDomain(row: HistoryEntryRow): HistoryEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.job_title,
    company: row.company,
    region: row.region,
    url: row.job_url,
    status: row.status,
    createdAt: new Date(row.created_at),
    exportedAt: row.exported_at ? new Date(row.exported_at) : null,
  }
}

async function currentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('SupabaseHistoryRepository: not authenticated')
  return user.id
}

export class SupabaseHistoryRepository implements HistoryRepository {
  async save(entry: HistoryEntry): Promise<HistoryEntry> {
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('history_entries')
      .upsert({
        id: entry.id,
        user_id: userId,
        job_id: entry.jobId,
        job_title: entry.jobTitle,
        company: entry.company,
        region: entry.region,
        job_url: entry.url,
        status: entry.status,
        created_at: entry.createdAt.toISOString(),
        exported_at: entry.exportedAt ? entry.exportedAt.toISOString() : null,
      }, { onConflict: 'user_id,job_id' })
      .select()
      .single()

    if (error) throw new Error(`SupabaseHistoryRepository.save: ${error.message}`)
    return rowToDomain(data as HistoryEntryRow)
  }

  async findAll(): Promise<HistoryEntry[]> {
    const { data, error } = await supabase
      .from('history_entries')
      .select()
      .order('created_at', { ascending: false })

    if (error) throw new Error(`SupabaseHistoryRepository.findAll: ${error.message}`)
    return (data as HistoryEntryRow[]).map(rowToDomain)
  }

  async findById(id: string): Promise<HistoryEntry | null> {
    const { data, error } = await supabase
      .from('history_entries')
      .select()
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`SupabaseHistoryRepository.findById: ${error.message}`)
    return data ? rowToDomain(data as HistoryEntryRow) : null
  }

  async findByJobId(jobId: string): Promise<HistoryEntry | null> {
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('history_entries')
      .select()
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .maybeSingle()

    if (error) throw new Error(`SupabaseHistoryRepository.findByJobId: ${error.message}`)
    return data ? rowToDomain(data as HistoryEntryRow) : null
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('history_entries')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`SupabaseHistoryRepository.delete: ${error.message}`)
  }
}
