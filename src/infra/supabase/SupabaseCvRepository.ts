import { supabase } from './client'
import type { CvRepository } from '@/features/cv-base/application/ports/CvRepository'
import type { BaseCv } from '@/features/cv-base/domain/BaseCv'

// DB row shape
interface BaseCvRow {
  id: string
  user_id: string
  name: string
  data: Omit<BaseCv, 'id' | 'name' | 'createdAt' | 'updatedAt'>
  created_at: string
  updated_at: string
}

function rowToDomain(row: BaseCvRow): BaseCv {
  return {
    id: row.id,
    name: row.name,
    ...row.data,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

async function currentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('SupabaseCvRepository: not authenticated')
  return user.id
}

function domainToRow(cv: BaseCv): Omit<BaseCvRow, 'user_id' | 'created_at' | 'updated_at'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, name, createdAt, updatedAt, ...data } = cv
  return { id, name, data }
}

export class SupabaseCvRepository implements CvRepository {
  async save(cv: BaseCv): Promise<BaseCv> {
    const userId = await currentUserId()
    const row = domainToRow(cv)
    const { data, error } = await supabase
      .from('base_cvs')
      .upsert({ ...row, user_id: userId, updated_at: new Date().toISOString() })
      .select()
      .single()

    if (error) throw new Error(`SupabaseCvRepository.save: ${error.message}`)
    return rowToDomain(data as BaseCvRow)
  }

  async findById(id: string): Promise<BaseCv | null> {
    const { data, error } = await supabase
      .from('base_cvs')
      .select()
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`SupabaseCvRepository.findById: ${error.message}`)
    return data ? rowToDomain(data as BaseCvRow) : null
  }

  async findAll(): Promise<BaseCv[]> {
    const { data, error } = await supabase
      .from('base_cvs')
      .select()
      .order('created_at', { ascending: false })

    if (error) throw new Error(`SupabaseCvRepository.findAll: ${error.message}`)
    return (data as BaseCvRow[]).map(rowToDomain)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('base_cvs').delete().eq('id', id)
    if (error) throw new Error(`SupabaseCvRepository.delete: ${error.message}`)
  }
}

