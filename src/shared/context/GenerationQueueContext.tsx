/**
 * GenerationQueueContext
 *
 * Cola global de generación de CVs adaptados. Sobrevive a la navegación entre
 * pestañas porque vive fuera del router (montado en main.tsx).
 *
 * Semántica:
 *   - enqueue(job, deps) → añade a la cola si no está ya pending/generating
 *   - La cola se procesa en orden FIFO, un job a la vez
 *   - Estado por job: 'pending' | 'generating' | 'done' | 'error'
 *   - Cuando un job termina (done/error) se mantiene en el mapa para que los
 *     componentes puedan mostrar el resultado; se puede limpiar con clearJob(id)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { SearchListing } from '@/features/job-postings/ui/types/SearchListing'
import type { BaseCv } from '@/features/cv-base/domain/BaseCv'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { TailoredCvRepository } from '@/features/tailoring/application/ports/TailoredCvRepository'
import type { HistoryRepository } from '@/features/history/application/ports/HistoryRepository'
import type { AiClient } from '@/features/tailoring/application/ports/AiClient'
import { GeminiAiClient } from '@/infra/ai/GeminiAiClient'
import { listBaseCvs } from '@/features/cv-base/application/usecases/ListBaseCvs'
import type { CvRepository } from '@/features/cv-base/application/ports/CvRepository'
import { createHistoryEntry } from '@/features/history/domain/HistoryEntry'
import { addHistoryEntry } from '@/features/history/application/usecases/AddHistoryEntry'
import { updateHistoryStatus } from '@/features/history/application/usecases/UpdateHistoryStatus'
import { searchListingToJobPosting } from '@/features/job-postings/ui/utils/searchListingAdapter'

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type GenerationStatus = 'pending' | 'generating' | 'done' | 'error'

export interface GenerationJob {
  jobId: string
  job: SearchListing
  status: GenerationStatus
  tailoredCv?: TailoredCv
  error?: string
  /** Marca de tiempo de cuando se encola */
  enqueuedAt: number
}

export interface GenerationQueueDeps {
  cvRepository: CvRepository
  tailoredCvRepository: TailoredCvRepository
  historyRepository: HistoryRepository
  aiClient: AiClient
  strictness: number
}

interface GenerationQueueContextValue {
  /** Mapa jobId → estado de generación */
  jobs: Map<string, GenerationJob>
  /** Cola ordenada (pending primero, luego generating) */
  queue: GenerationJob[]
  /** Encola un job. No hace nada si ya está pending o generating. */
  enqueue: (job: SearchListing, deps: GenerationQueueDeps) => void
  /** Elimina el resultado de un job del mapa (limpieza manual) */
  clearJob: (jobId: string) => void
}

// ── Contexto ──────────────────────────────────────────────────────────────────

const GenerationQueueContext = createContext<GenerationQueueContextValue>({
  jobs: new Map(),
  queue: [],
  enqueue: () => {},
  clearJob: () => {},
})

export function useGenerationQueue() {
  return useContext(GenerationQueueContext)
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function GenerationQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Map<string, GenerationJob>>(new Map())
  // Cola: ids en orden FIFO de los que están pending
  const pendingQueueRef = useRef<string[]>([])
  // Flag para saber si el worker está corriendo
  const isProcessingRef = useRef(false)
  // Deps almacenadas para el worker (las del primer enqueue sirven; se actualizan)
  const depsRef = useRef<GenerationQueueDeps | null>(null)
  // Ref al mapa de jobs para el worker (evita closures stale)
  const jobsRef = useRef<Map<string, GenerationJob>>(new Map())

  // Mantener jobsRef sincronizado con el estado
  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  const updateJob = useCallback((jobId: string, patch: Partial<GenerationJob>) => {
    setJobs(prev => {
      const next = new Map(prev)
      const current = next.get(jobId)
      if (current) next.set(jobId, { ...current, ...patch })
      return next
    })
  }, [])

  // Worker: procesa un job a la vez
  const processNext = useCallback(async () => {
    if (isProcessingRef.current) return
    const nextId = pendingQueueRef.current[0]
    if (!nextId || !depsRef.current) return

    isProcessingRef.current = true
    const deps = depsRef.current

    updateJob(nextId, { status: 'generating' })

    try {
      const cvs = await listBaseCvs(deps.cvRepository)
      if (cvs.length === 0) throw new Error('No hay CV base — crea uno primero')

      const baseCv: BaseCv = cvs[0]
      const jobEntry = jobsRef.current.get(nextId)
      if (!jobEntry) throw new Error('Job no encontrado en la cola')

      const jobPosting = searchListingToJobPosting(jobEntry.job)

      const rawSettings = localStorage.getItem('jobtaylor-settings')
      const outputLanguage: string = rawSettings
        ? (JSON.parse(rawSettings).outputLanguage ?? 'ES')
        : 'ES'

      // Recuperar descripción enriquecida de sessionStorage si existe para este job.
      // Proporciona más contexto al prompt que la descripción cruda de Adzuna.
      let enrichedDescription: string = jobEntry.job.description ?? ''
      try {
        const enrichedMap = JSON.parse(sessionStorage.getItem('search.enrichedJobs') ?? '{}') as Record<string, { description?: string }>
        const enriched = enrichedMap[nextId]
        if (enriched?.description) enrichedDescription = enriched.description
      } catch { /* sessionStorage may be unavailable — use raw description */ }

      // Read score from sessionStorage if it was computed during search
      let jobScore: number | null = null
      try {
        const scoresRaw = sessionStorage.getItem('search.jobScores')
        if (scoresRaw) {
          const scoresMap = JSON.parse(scoresRaw) as Record<string, number>
          const s = scoresMap[nextId]
          if (typeof s === 'number' && !isNaN(s)) jobScore = s
        }
      } catch { /* non-critical */ }

      const client = new GeminiAiClient(deps.strictness, enrichedDescription, outputLanguage)

      const { tailoredData, gaps, suggestions } = await client.tailorCv(baseCv, jobPosting)

      const tailored: TailoredCv = {
        id: crypto.randomUUID(),
        baseCvId: baseCv.id,
        jobPostingId: nextId,
        jobTitle: jobEntry.job.title,
        jobDescription: enrichedDescription ?? jobEntry.job.description ?? '',
        score: jobScore,
        tailoredData,
        gaps,
        suggestions,
        guardrailsApplied: true,
        createdAt: new Date(),
      }

      // Persistir CV adaptado
      try { await deps.tailoredCvRepository.save(tailored) } catch { /* non-critical */ }

      // Actualizar historial
      const job = jobEntry.job
      try {
        const entries = await deps.historyRepository.findAll()
        const exists = entries.find(e => e.jobId === nextId)
        if (!exists) {
          await addHistoryEntry(deps.historyRepository, createHistoryEntry({
            jobId: nextId,
            jobTitle: job.title,
            company: job.company,
            region: job.location,
            status: 'generated',
          }))
        } else {
          await updateHistoryStatus(deps.historyRepository, nextId, 'generated')
        }
      } catch { /* non-critical */ }

      updateJob(nextId, { status: 'done', tailoredCv: tailored })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[GenerationQueue] Error generando', nextId, msg)
      updateJob(nextId, { status: 'error', error: msg })
    } finally {
      // Quitar de la cola y procesar el siguiente
      pendingQueueRef.current = pendingQueueRef.current.filter(id => id !== nextId)
      isProcessingRef.current = false
      // Pequeño delay para no bloquear el hilo de render
      setTimeout(() => processNext(), 50)
    }
  }, [updateJob])

  const enqueue = useCallback((job: SearchListing, deps: GenerationQueueDeps) => {
    const jobId = job.id
    const current = jobsRef.current.get(jobId)
    // No añadir si ya está en proceso activo
    if (current && (current.status === 'pending' || current.status === 'generating')) return

    // Guardar deps (se actualizan cada vez por si cambia aiMode/strictness)
    depsRef.current = deps

    const entry: GenerationJob = {
      jobId,
      job,
      status: 'pending',
      enqueuedAt: Date.now(),
    }

    setJobs(prev => {
      const next = new Map(prev)
      next.set(jobId, entry)
      return next
    })

    pendingQueueRef.current = [...pendingQueueRef.current, jobId]

    // Arrancar worker si no está corriendo
    setTimeout(() => processNext(), 0)
  }, [processNext])

  const clearJob = useCallback((jobId: string) => {
    setJobs(prev => {
      const next = new Map(prev)
      next.delete(jobId)
      return next
    })
  }, [])

  // Cola para la UI (orden FIFO: pending primero)
  const queue = Array.from(jobs.values())
    .filter(j => j.status === 'pending' || j.status === 'generating')
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt)

  return (
    <GenerationQueueContext.Provider value={{ jobs, queue, enqueue, clearJob }}>
      {children}
    </GenerationQueueContext.Provider>
  )
}
