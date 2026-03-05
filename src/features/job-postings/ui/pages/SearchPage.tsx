import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { ArrowUpDown, Search as SearchIcon, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppDeps } from '@/app/AppDepsContext'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SearchListing, WorkMode } from '../types/SearchListing'
import type { BaseCv } from '@/features/cv-base/domain/BaseCv'
import type { EnrichedJob } from '@/features/job-postings/application/ports/JobEnrichmentPort'
import { useEnrichmentAdapter } from '@/features/job-postings/application/hooks/useEnrichmentAdapter'
import { useScoreAdapter } from '@/features/job-postings/application/hooks/useScoreAdapter'
import { cvToPlainText } from '@/features/cv-base/domain/cvToPlainText'
import { FilterBar } from '../components/FilterBar'
import { JobCard } from '../components/JobCard'
import { JobDetailPanel } from '../components/JobDetailPanel'
import { SkeletonList } from '../components/SkeletonList'
import { EmptyState } from '../components/EmptyState'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { listHistoryEntries } from '@/features/history/application/usecases/ListHistoryEntries'
import { addHistoryEntry } from '@/features/history/application/usecases/AddHistoryEntry'
import { removeHistoryEntry } from '@/features/history/application/usecases/RemoveHistoryEntry'
import { updateHistoryStatus } from '@/features/history/application/usecases/UpdateHistoryStatus'
import { createHistoryEntry } from '@/features/history/domain/HistoryEntry'
import type { HistoryStatus } from '@/features/history/domain/HistoryEntry'
import { listBaseCvs } from '@/features/cv-base/application/usecases/ListBaseCvs'
import { exportTailoredCv } from '@/infra/export/exportTailoredCv'
import { useSettings } from '@/features/settings/ui/hooks/useSettings'
import { usePhoto } from '@/features/settings/ui/hooks/usePhoto'
import { useGenerationQueue } from '@/shared/context/GenerationQueueContext'

type SortField = 'date' | 'score'

const DEBOUNCE_MS = 600
const PAGE_SIZE = 20
const MAX_PAGES = 10 // máximo de páginas a cargar (200 ofertas)

export function SearchPage() {
  const { historyRepository, cvRepository, aiClient, tailoredCvRepository, jobFeedPort } = useAppDeps()
  const settings = useSettings()
  const photo = usePhoto()
  const location = useLocation()
  const navigate = useNavigate()
  const generationQueue = useGenerationQueue()
  const { t } = useTranslation()
  // Reactive adapters — rebuild when aiMode changes
  const jobEnrichmentPort = useEnrichmentAdapter(settings.aiMode)
  const scoreAdapter = useScoreAdapter(settings.aiMode)

  // ── Estado persistido en sessionStorage (sobrevive navegación entre páginas) ──
  const [query, setQuery] = useState<string>(() => sessionStorage.getItem('search.query') ?? '')
  const [selectedLocations, setSelectedLocations] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('search.locations') ?? '[]') } catch { return [] }
  })
  const [workMode, setWorkMode] = useState<WorkMode | 'all'>(() =>
    (sessionStorage.getItem('search.workMode') as WorkMode | 'all') ?? 'all'
  )
  const [remoteOnly, setRemoteOnly] = useState<boolean>(() =>
    sessionStorage.getItem('search.remoteOnly') === 'true'
  )
  const [sortBy, setSortBy] = useState<SortField>(() =>
    (sessionStorage.getItem('search.sortBy') as SortField) ?? 'score'
  )
  const [selectedJob, setSelectedJob] = useState<SearchListing | null>(() => {
    // Do not restore the selected job on a full page reload — only on SPA navigation.
    // performance.navigation.type 1 = reload; PerformanceNavigationTiming type 'reload'
    try {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      const isReload = navEntry ? navEntry.type === 'reload' : performance.navigation?.type === 1
      if (isReload) {
        sessionStorage.removeItem('search.selectedJob')
        return null
      }
      const s = sessionStorage.getItem('search.selectedJob')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(() => {
    // Si hay resultados cacheados, arrancamos sin skeleton mientras se refresca en background
    try { const s = sessionStorage.getItem('search.listings'); return !s || JSON.parse(s).length === 0 } catch { return true }
  })
  const [allListings, setAllListings] = useState<SearchListing[]>(() => {
    try { const s = sessionStorage.getItem('search.listings'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [feedError, setFeedError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [apiHasMore, setApiHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // CV Base — stored as a promise so handleSelectJob can always await it,
  // even if the user clicks a job card before the async load finishes.
  const baseCvPromiseRef = useRef<Promise<BaseCv | null>>(Promise.resolve(null))

  // Estado del historial y exportación
  const [historyStatuses, setHistoryStatuses] = useState<Map<string, HistoryStatus>>(new Map())
  const [exportingJobId, setExportingJobId] = useState<string | null>(null)

  // Scores calculados por el scoring AI (por jobId) — persistidos en sessionStorage
  const [jobScores, setJobScores] = useState<Map<string, number>>(() => {
    try {
      const s = sessionStorage.getItem('search.jobScores')
      return s ? new Map(Object.entries(JSON.parse(s) as Record<string, number>)) : new Map()
    } catch { return new Map() }
  })
  const [scoringJobId, setScoringJobId] = useState<string | null>(null)

  // Enriched job data (por jobId) — persistidos en sessionStorage
  const [enrichedJobs, setEnrichedJobs] = useState<Map<string, EnrichedJob>>(() => {
    try {
      const s = sessionStorage.getItem('search.enrichedJobs')
      return s ? new Map(Object.entries(JSON.parse(s) as Record<string, EnrichedJob>)) : new Map()
    } catch { return new Map() }
  })
  const [enrichingJobId, setEnrichingJobId] = useState<string | null>(null)

  // jobId pendiente de seleccionar desde History (se resuelve cuando allListings carga)
  const pendingJobIdRef = useRef<string | null>(null)

  // Ref para el contenedor scrollable de la lista de jobs
  const listScrollRef = useRef<HTMLDivElement>(null)

  // Guardar posición de scroll al hacer scroll
  function handleListScroll() {
    if (listScrollRef.current) {
      sessionStorage.setItem('search.scrollTop', String(listScrollRef.current.scrollTop))
    }
  }

  // Restaurar posición de scroll cuando los resultados cargan
  useEffect(() => {
    if (isLoading || !listScrollRef.current) return
    const saved = parseInt(sessionStorage.getItem('search.scrollTop') ?? '0', 10)
    if (saved > 0) {
      // Pequeño delay para que el DOM termine de renderizar los cards
      const t = setTimeout(() => {
        listScrollRef.current?.scrollTo({ top: saved, behavior: 'instant' })
      }, 50)
      return () => clearTimeout(t)
    }
  }, [isLoading])

  // Persistir todo el estado de búsqueda en sessionStorage
  useEffect(() => { sessionStorage.setItem('search.query', query) }, [query])
  useEffect(() => { sessionStorage.setItem('search.locations', JSON.stringify(selectedLocations)) }, [selectedLocations])
  useEffect(() => { sessionStorage.setItem('search.workMode', workMode) }, [workMode])
  useEffect(() => { sessionStorage.setItem('search.remoteOnly', String(remoteOnly)) }, [remoteOnly])
  useEffect(() => { sessionStorage.setItem('search.sortBy', sortBy) }, [sortBy])
  useEffect(() => {
    if (selectedJob) sessionStorage.setItem('search.selectedJob', JSON.stringify(selectedJob))
    else sessionStorage.removeItem('search.selectedJob')
  }, [selectedJob])
  useEffect(() => {
    if (allListings.length > 0) sessionStorage.setItem('search.listings', JSON.stringify(allListings))
  }, [allListings])
  useEffect(() => {
    const obj = Object.fromEntries(jobScores)
    sessionStorage.setItem('search.jobScores', JSON.stringify(obj))
  }, [jobScores])
  useEffect(() => {
    const obj = Object.fromEntries(enrichedJobs)
    sessionStorage.setItem('search.enrichedJobs', JSON.stringify(obj))
  }, [enrichedJobs])

  // Core fetch — page=1 replaces list, page>1 appends
  const fetchListings = useCallback(async (keywords?: string, page = 1) => {
    if (page === 1) {
      setIsLoading(true)
      setFeedError(null)
      // Do NOT reset jobScores here — they are persisted in sessionStorage and
      // must survive new searches so previously scored jobs keep their badges.
    } else {
      setIsLoadingMore(true)
    }
    try {
      const results = await jobFeedPort.search({
        keywords: keywords?.trim() || undefined,
        page,
      })
      if (page === 1) {
        setAllListings(results)
      } else {
        setAllListings(prev => [...prev, ...results])
      }
      setApiHasMore(results.length >= PAGE_SIZE && page < MAX_PAGES)
      setCurrentPage(page)
    } catch (err) {
      console.error('Job feed error:', err)
      if (page === 1) {
        setFeedError(t('search.errorTitle'))
        setAllListings([])
      }
    } finally {
      if (page === 1) setIsLoading(false)
      else setIsLoadingMore(false)
    }
  }, [jobFeedPort])

  // Debounced search — resets to page 1
  function handleQueryChange(value: string) {
    setQuery(value)
    setCurrentPage(1)
    setApiHasMore(true)
    setVisibleCount(PAGE_SIZE)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchListings(value, 1)
    }, DEBOUNCE_MS)
  }

  function handleSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setCurrentPage(1)
    setApiHasMore(true)
    setVisibleCount(PAGE_SIZE)
    fetchListings(query, 1)
  }

  // Init
  useEffect(() => {
    // Cargar CV base — guardamos la Promise para que handleSelectJob pueda awaitar
    // incluso si el usuario hace click antes de que termine la carga.
    baseCvPromiseRef.current = listBaseCvs(cvRepository)
      .then(cvs => cvs[0] ?? null)
      .catch(() => null)

    // Restaurar búsqueda guardada — si ya hay resultados en caché los mostramos
    // y relanzamos la búsqueda en background para refrescar
    const savedQuery = sessionStorage.getItem('search.query') ?? ''
    fetchListings(savedQuery || undefined, 1)

    listHistoryEntries(historyRepository)
      .then(entries => {
        const savedIds = new Set(entries.map(e => e.jobId))
        setSavedJobs(savedIds)
        const statusMap = new Map<string, HistoryStatus>()
        for (const e of entries) statusMap.set(e.jobId, e.status)
        setHistoryStatuses(statusMap)
      })
      .catch(console.error)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyRepository])

  // Pre-select a job when navigating from History
  useEffect(() => {
    const jobId = (location.state as { jobId?: string } | null)?.jobId
    if (!jobId) return

    // Limpiar el state para que no interfiera con futuras navegaciones
    navigate('/search', { replace: true, state: null })

    // Si ya está en la lista actual, lo abrimos directamente
    const match = allListings.find(j => j.id === jobId)
    if (match) {
      setSelectedJob(match)
      return
    }

    // Si no está, guardamos el jobId y limpiamos la búsqueda para recargar todos los resultados
    pendingJobIdRef.current = jobId
    setQuery('')
    sessionStorage.setItem('search.query', '')
    fetchListings(undefined, 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // Cuando allListings cambia, intentamos resolver el jobId pendiente
  useEffect(() => {
    if (!pendingJobIdRef.current || allListings.length === 0) return
    const match = allListings.find(j => j.id === pendingJobIdRef.current)
    if (match) {
      setSelectedJob(match)
      pendingJobIdRef.current = null
    }
  }, [allListings])

  // Ubicaciones únicas derivadas de los resultados actuales (ordenadas alfabéticamente)
  const availableLocations = useMemo(() => {
    const locs = new Set(allListings.map(j => j.location).filter(Boolean))
    return Array.from(locs).sort()
  }, [allListings])

  // Limpiar selectedLocations que ya no estén en los resultados al cambiar búsqueda
  useEffect(() => {
    if (availableLocations.length === 0) return
    setSelectedLocations(prev => prev.filter(l => availableLocations.includes(l)))
  }, [availableLocations])

  // Filtros + ordenación (sobre todos los datos cargados de la API)
  const filteredJobs = useMemo(() => {
    let results = [...allListings]
    if (selectedLocations.length > 0) {
      results = results.filter(j => selectedLocations.includes(j.location))
    }
    if (workMode !== 'all') {
      results = results.filter(j => j.workMode === workMode)
    }
    if (remoteOnly) {
      results = results.filter(j => j.workMode === 'Remote')
    }
    results.sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = jobScores.get(a.id) ?? a.matchScore
        const scoreB = jobScores.get(b.id) ?? b.matchScore
        return scoreB - scoreA
      }
      return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime()
    })
    return results
  }, [selectedLocations, workMode, remoteOnly, sortBy, allListings, jobScores])

  // Resetear visibleCount cuando cambian los filtros client-side
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedLocations, workMode, remoteOnly, sortBy])

  // Jobs a renderizar (slice del conjunto filtrado)
  const displayedJobs = filteredJobs.slice(0, visibleCount)

  // hasMore: hay más items filtrados sin mostrar, O la API tiene más páginas
  const hasMore = visibleCount < filteredJobs.length || apiHasMore

  // Scroll listener — carga más cuando el usuario llega cerca del final
  useEffect(() => {
    const container = listScrollRef.current
    if (!container) return

    function handleScroll() {
      if (!container) return
      if (isLoading || isLoadingMore || !hasMore) return
      const { scrollTop, scrollHeight, clientHeight } = container
      const nearBottom = scrollHeight - scrollTop - clientHeight < 200
      if (!nearBottom) return
      if (visibleCount < filteredJobs.length) {
        setVisibleCount(prev => prev + PAGE_SIZE)
      } else if (apiHasMore) {
        fetchListings(query, currentPage + 1)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [isLoading, isLoadingMore, hasMore, visibleCount, filteredJobs.length, apiHasMore, currentPage, query, fetchListings])

  // Seleccionar job: lanza enrichment y scoring on-demand con caché
  async function handleSelectJob(job: SearchListing) {
    setSelectedJob(job)

    const alreadyScored = jobScores.has(job.id)
    const alreadyEnriched = enrichedJobs.has(job.id)
    const enrichmentInProgress = enrichingJobId === job.id

    // ── Enrichment ──────────────────────────────────────────────────────────
    // Lanza el enriquecimiento si el job tiene URL y no está ya enriquecido ni en progreso
    let enrichmentPromise: Promise<EnrichedJob | null> = Promise.resolve(
      alreadyEnriched ? (enrichedJobs.get(job.id) ?? null) : null
    )

    if (job.url && !alreadyEnriched && !enrichmentInProgress) {
      setEnrichingJobId(job.id)
      console.log(`[enrichment] Starting enrichment for job ${job.id} (aiMode=${settings.aiMode}) url=${job.url}`)
      enrichmentPromise = jobEnrichmentPort.enrich(job.url, settings.outputLanguage)
        .then(enriched => {
          console.log(`[enrichment] Success for job ${job.id}`, enriched)
          setEnrichedJobs(prev => new Map(prev).set(job.id, enriched))
          return enriched
        })
        .catch(err => {
          console.error('[enrichment] Failed for', job.id, err)
          return null
        })
        .finally(() => setEnrichingJobId(null))
    }

    // ── Scoring ─────────────────────────────────────────────────────────────
    // Awaits both enrichment AND the baseCv load promise, so the user can click
    // immediately after mount without losing the scoring step.
    if (!alreadyScored) {
      setScoringJobId(job.id)

      Promise.all([enrichmentPromise, baseCvPromiseRef.current])
        .then(([enriched, cv]) => {
          if (!cv) throw new Error('No base CV available for scoring')
          const cvPreview = cvToPlainText(cv)
          // Preferimos la descripción enriquecida; fallback a Adzuna description
          const jobDescription = enriched?.description ?? job.description ?? ''
          if (!jobDescription) throw new Error('No job description available for scoring')
          console.log(`[scoring] Starting for job ${job.id} (aiMode=${settings.aiMode})`)
          return scoreAdapter.score(cvPreview, jobDescription)
        })
        .then(result => {
          console.log(`[scoring] Score for job ${job.id}: ${result.score}`)
          setJobScores(prev => new Map(prev).set(job.id, result.score))
        })
        .catch(err => console.error('[scoring] Failed for', job.id, err))
        .finally(() => setScoringJobId(null))
    }
  }

  function handleSave(job: SearchListing) {
    const isSaved = savedJobs.has(job.id)
    if (isSaved) {
      setSavedJobs(prev => { const n = new Set(prev); n.delete(job.id); return n })
      setHistoryStatuses(prev => { const n = new Map(prev); n.delete(job.id); return n })
      removeHistoryEntry(historyRepository, job.id).catch(console.error)
    } else {
      setSavedJobs(prev => new Set(prev).add(job.id))
      setHistoryStatuses(prev => new Map(prev).set(job.id, 'saved'))
      const entry = createHistoryEntry({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        region: job.location,
        url: job.url,
      })
      addHistoryEntry(historyRepository, entry).catch(console.error)
    }
  }

  function handleGenerate(job: SearchListing) {
    generationQueue.enqueue(job, {
      cvRepository,
      tailoredCvRepository,
      historyRepository,
      aiClient,
      aiMode: settings.aiMode,
      strictness: settings.strictness,
    })
    // Marcar como guardada en historial si no lo está ya
    if (!savedJobs.has(job.id)) {
      setSavedJobs(prev => new Set(prev).add(job.id))
      setHistoryStatuses(prev => new Map(prev).set(job.id, 'saved'))
      addHistoryEntry(historyRepository, createHistoryEntry({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        region: job.location,
        url: job.url,
      })).catch(console.error)
    }
  }

  async function handleExport(job: SearchListing) {
    const queueEntry = generationQueue.jobs.get(job.id)
    const tailored = queueEntry?.tailoredCv
    if (!tailored || exportingJobId) return
    setExportingJobId(job.id)
    try {
      await exportTailoredCv(tailored, {
        format: settings.exportFormat,
        template: settings.template,
        photo,
      })
      setHistoryStatuses(prev => new Map(prev).set(job.id, 'exported'))
      await updateHistoryStatus(historyRepository, job.id, 'exported')
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExportingJobId(null)
    }
  }

  // Sincronizar historyStatuses cuando la cola completa un job
  useEffect(() => {
    generationQueue.jobs.forEach((entry, jobId) => {
      if (entry.status === 'done') {
        setHistoryStatuses(prev => {
          if (prev.get(jobId) === 'generated' || prev.get(jobId) === 'exported') return prev
          const next = new Map(prev)
          next.set(jobId, 'generated')
          return next
        })
        setSavedJobs(prev => new Set(prev).add(jobId))
      }
    })
  }, [generationQueue.jobs])

  function clearFilters() {
    setQuery('')
    setSelectedLocations([])
    setWorkMode('all')
    setRemoteOnly(false)
    setCurrentPage(1)
    setApiHasMore(true)
    setVisibleCount(PAGE_SIZE)
    fetchListings(undefined, 1)
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* ── Left panel ── */}
      <div className="flex flex-col lg:w-[440px] xl:w-[480px] lg:border-r border-border lg:shrink-0">
        <div className="border-b border-border p-4">
          <FilterBar
            query={query}
            onQueryChange={handleQueryChange}
            availableLocations={availableLocations}
            selectedLocations={selectedLocations}
            onLocationsChange={setSelectedLocations}
            workMode={workMode}
            onWorkModeChange={setWorkMode}
            remoteOnly={remoteOnly}
            onRemoteOnlyChange={setRemoteOnly}
            onClear={clearFilters}
            onSearch={handleSearch}
          />
        </div>

        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {isLoading ? t('search.loading') : feedError ? t('search.error') : t('search.results', { count: filteredJobs.length })}
          </span>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortField)}>
              <SelectTrigger className="h-7 w-[110px] border-none bg-transparent text-xs shadow-none p-0 pl-1 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">{t('search.sortByScore')}</SelectItem>
                <SelectItem value="date">{t('search.sortByDate')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div ref={listScrollRef} onScroll={handleListScroll} className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <SkeletonList count={6} />
          ) : feedError ? (
            <EmptyState
              icon={SearchIcon}
              title={t('search.errorTitle')}
              description={feedError}
            >
              <Button variant="outline" size="sm" onClick={() => fetchListings(query, 1)}>
                {t('search.retry')}
              </Button>
            </EmptyState>
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title={t('search.noResults')}
              description={t('search.noResultsDesc')}
            >
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t('search.clearFilters')}
              </Button>
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {displayedJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  isSaved={savedJobs.has(job.id)}
                  score={jobScores.get(job.id) ?? null}
                  isScoring={scoringJobId === job.id}
                  onSelect={handleSelectJob}
                  onSave={handleSave}
                />
              ))}
              {/* Spinner de carga */}
              {isLoadingMore && (
                <div className="flex justify-center py-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              {!hasMore && filteredJobs.length > 0 && (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  {t('search.noMoreResults')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel (desktop) ── */}
      <div className="hidden lg:flex flex-1 flex-col bg-card">
        <JobDetailPanel
          job={selectedJob}
          isSaved={selectedJob ? savedJobs.has(selectedJob.id) : false}
          historyStatus={selectedJob ? (historyStatuses.get(selectedJob.id) ?? null) : null}
          tailoredCv={selectedJob ? (generationQueue.jobs.get(selectedJob.id)?.tailoredCv ?? null) : null}
          generationStatus={selectedJob ? (generationQueue.jobs.get(selectedJob.id)?.status ?? null) : null}
          isExporting={selectedJob?.id === exportingJobId}
          isScoring={selectedJob?.id === scoringJobId}
          score={selectedJob ? (jobScores.get(selectedJob.id) ?? null) : null}
          enrichedJob={selectedJob ? (enrichedJobs.get(selectedJob.id) ?? null) : null}
          isEnriching={selectedJob?.id === enrichingJobId}
          exportFormat={settings.exportFormat}
          onSave={handleSave}
          onGenerate={handleGenerate}
          onExport={handleExport}
        />
      </div>

      {/* ── Mobile bottom sheet ── */}
      {selectedJob && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setSelectedJob(null)}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 top-16 bg-card rounded-t-xl border-t border-border overflow-hidden">
            <div className="flex items-center justify-end p-2 border-b border-border">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => setSelectedJob(null)}
              >
                <X className="h-3.5 w-3.5" />
                {t('search.close')}
              </Button>
            </div>
            <div className="h-full overflow-y-auto pb-20">
              <JobDetailPanel
                job={selectedJob}
                isSaved={savedJobs.has(selectedJob.id)}
                historyStatus={historyStatuses.get(selectedJob.id) ?? null}
                tailoredCv={generationQueue.jobs.get(selectedJob.id)?.tailoredCv ?? null}
                generationStatus={generationQueue.jobs.get(selectedJob.id)?.status ?? null}
                isExporting={selectedJob.id === exportingJobId}
                isScoring={selectedJob.id === scoringJobId}
                score={jobScores.get(selectedJob.id) ?? null}
                enrichedJob={enrichedJobs.get(selectedJob.id) ?? null}
                isEnriching={selectedJob.id === enrichingJobId}
                exportFormat={settings.exportFormat}
                onSave={handleSave}
                onGenerate={handleGenerate}
                onExport={handleExport}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
