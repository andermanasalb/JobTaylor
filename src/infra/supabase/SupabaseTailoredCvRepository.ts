import { supabase } from './client'
import type { TailoredCvRepository } from '@/features/tailoring/application/ports/TailoredCvRepository'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { BaseCv } from '@/features/cv-base/domain/BaseCv'

interface TailoredCvRow {
  id: string
  user_id: string
  base_cv_id: string
  job_posting_id: string
  job_title: string
  job_description: string
  score: number | null
  tailored_data: BaseCv
  gaps: string[]
  suggestions: string[]
  guardrails_applied: true
  created_at: string
}

function rowToDomain(row: TailoredCvRow): TailoredCv {
  return {
    id: row.id,
    baseCvId: row.base_cv_id,
    jobPostingId: row.job_posting_id,
    jobTitle: row.job_title ?? '',
    jobDescription: row.job_description ?? '',
    score: row.score ?? null,
    tailoredData: row.tailored_data,
    gaps: row.gaps,
    suggestions: row.suggestions,
    guardrailsApplied: true,
    createdAt: new Date(row.created_at),
  }
}

async function currentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('SupabaseTailoredCvRepository: not authenticated')
  return user.id
}

export class SupabaseTailoredCvRepository implements TailoredCvRepository {
  async save(cv: TailoredCv): Promise<TailoredCv> {
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('tailored_cvs')
      .upsert({
        id: cv.id,
        user_id: userId,
        base_cv_id: cv.baseCvId,
        job_posting_id: cv.jobPostingId,
        job_title: cv.jobTitle,
        job_description: cv.jobDescription,
        score: cv.score,
        tailored_data: cv.tailoredData,
        gaps: cv.gaps,
        suggestions: cv.suggestions,
        guardrails_applied: true,
      }, { onConflict: 'user_id,job_posting_id' })
      .select()
      .single()

    if (error) throw new Error(`SupabaseTailoredCvRepository.save: ${error.message}`)
    return rowToDomain(data as TailoredCvRow)
  }

  async findById(id: string): Promise<TailoredCv | null> {
    const { data, error } = await supabase
      .from('tailored_cvs')
      .select()
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`SupabaseTailoredCvRepository.findById: ${error.message}`)
    return data ? rowToDomain(data as TailoredCvRow) : null
  }

  async findByJobPostingId(jobPostingId: string): Promise<TailoredCv[]> {
    const { data, error } = await supabase
      .from('tailored_cvs')
      .select()
      .eq('job_posting_id', jobPostingId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`SupabaseTailoredCvRepository.findByJobPostingId: ${error.message}`)
    return (data as TailoredCvRow[]).map(rowToDomain)
  }

  async findByBaseCvId(baseCvId: string): Promise<TailoredCv[]> {
    const { data, error } = await supabase
      .from('tailored_cvs')
      .select()
      .eq('base_cv_id', baseCvId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`SupabaseTailoredCvRepository.findByBaseCvId: ${error.message}`)
    return (data as TailoredCvRow[]).map(rowToDomain)
  }

  async findAll(): Promise<TailoredCv[]> {
    const { data, error } = await supabase
      .from('tailored_cvs')
      .select()
      .order('created_at', { ascending: false })

    if (error) throw new Error(`SupabaseTailoredCvRepository.findAll: ${error.message}`)
    return (data as TailoredCvRow[]).map(rowToDomain)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('tailored_cvs').delete().eq('id', id)
    if (error) throw new Error(`SupabaseTailoredCvRepository.delete: ${error.message}`)
  }
}

