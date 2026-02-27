import { supabase } from './client'
import type { JobPostingRepository } from '@/features/job-postings/application/ports/JobPostingRepository'
import type { JobPosting, JobStatus, JobSource } from '@/features/job-postings/domain/JobPosting'

interface JobPostingRow {
  id: string
  user_id: string
  title: string
  company: string
  location: string | null
  remote: boolean
  source: JobSource
  url: string | null
  description: string
  requirements: JobPosting['requirements']
  status: JobStatus
  created_at: string
  updated_at: string
}

function rowToDomain(row: JobPostingRow): JobPosting {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location ?? '',
    remote: row.remote,
    source: row.source,
    sourceUrl: row.url ?? undefined,
    description: row.description,
    requirements: row.requirements,
    status: row.status,
    createdAt: new Date(row.created_at),
    savedAt: new Date(row.created_at),
  }
}

async function currentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('SupabaseJobPostingRepository: not authenticated')
  return user.id
}

function domainToRow(posting: JobPosting): Omit<JobPostingRow, 'user_id' | 'created_at' | 'updated_at'> {
  return {
    id: posting.id,
    title: posting.title,
    company: posting.company,
    location: posting.location ?? null,
    remote: posting.remote ?? false,
    source: posting.source,
    url: posting.sourceUrl ?? null,
    description: posting.description,
    requirements: posting.requirements,
    status: posting.status,
  }
}

export class SupabaseJobPostingRepository implements JobPostingRepository {
  async save(posting: JobPosting): Promise<JobPosting> {
    const userId = await currentUserId()
    const row = domainToRow(posting)
    const { data, error } = await supabase
      .from('job_postings')
      .upsert({ ...row, user_id: userId, updated_at: new Date().toISOString() })
      .select()
      .single()

    if (error) throw new Error(`SupabaseJobPostingRepository.save: ${error.message}`)
    return rowToDomain(data as JobPostingRow)
  }

  async findById(id: string): Promise<JobPosting | null> {
    const { data, error } = await supabase
      .from('job_postings')
      .select()
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`SupabaseJobPostingRepository.findById: ${error.message}`)
    return data ? rowToDomain(data as JobPostingRow) : null
  }

  async findAll(): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select()
      .order('created_at', { ascending: false })

    if (error) throw new Error(`SupabaseJobPostingRepository.findAll: ${error.message}`)
    return (data as JobPostingRow[]).map(rowToDomain)
  }

  async findByStatus(status: JobStatus): Promise<JobPosting[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select()
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`SupabaseJobPostingRepository.findByStatus: ${error.message}`)
    return (data as JobPostingRow[]).map(rowToDomain)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('job_postings').delete().eq('id', id)
    if (error) throw new Error(`SupabaseJobPostingRepository.delete: ${error.message}`)
  }
}

