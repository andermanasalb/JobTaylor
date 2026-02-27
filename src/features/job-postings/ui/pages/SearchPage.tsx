import { useState, useMemo, useEffect } from 'react'
import { ArrowUpDown, Search as SearchIcon, X } from 'lucide-react'
import { useAppDeps } from '@/app/AppDepsContext'
import { useLocation } from 'react-router-dom'
import { mockListings } from '../mock/searchMock'
import type { SearchListing, Region, Seniority } from '../types/SearchListing'
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
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import { exportTailoredCv } from '@/infra/export/exportTailoredCv'
import { useSettings } from '@/features/settings/ui/hooks/useSettings'
import { usePhoto } from '@/features/settings/ui/hooks/usePhoto'
import { searchListingToJobPosting } from '../utils/searchListingAdapter'

type SortField = 'date' | 'score'

export function SearchPage() {
  const { historyRepository, cvRepository, aiClient, tailoredCvRepository } = useAppDeps()
  const settings = useSettings()
  const photo = usePhoto()
  const location = useLocation()

  const [query, setQuery] = useState('')
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([])
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [seniority, setSeniority] = useState<Seniority | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortField>('score')
  const [selectedJob, setSelectedJob] = useState<SearchListing | null>(null)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Inline generation state
  const [historyStatuses, setHistoryStatuses] = useState<Map<string, HistoryStatus>>(new Map())
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null)
  const [tailoredCvs, setTailoredCvs] = useState<Map<string, TailoredCv>>(new Map())
  const [exportingJobId, setExportingJobId] = useState<string | null>(null)

  // Init: simulate data fetch + load saved-job IDs, statuses and cached tailored CVs
  useEffect(() => {
    const dataTimer = setTimeout(() => setIsLoading(false), 600)

    listHistoryEntries(historyRepository)
      .then(entries => {
        const savedIds = new Set(entries.map(e => e.jobId))
        setSavedJobs(savedIds)
        const statusMap = new Map<string, HistoryStatus>()
        for (const e of entries) statusMap.set(e.jobId, e.status)
        setHistoryStatuses(statusMap)
      })
      .catch(console.error)

    // Pre-load any previously generated CVs from the repo
    tailoredCvRepository.findAll()
      .then(all => {
        const map = new Map<string, TailoredCv>()
        for (const cv of all) map.set(cv.jobPostingId, cv)
        setTailoredCvs(map)
      })
      .catch(console.error)

    return () => clearTimeout(dataTimer)
  }, [historyRepository, tailoredCvRepository])

  // Pre-select a job when navigating from History (location state { jobId })
  useEffect(() => {
    const jobId = (location.state as { jobId?: string } | null)?.jobId
    if (!jobId) return
    const match = mockListings.find(j => j.id === jobId)
    if (match) setSelectedJob(match)
  }, [location.state])

  const filteredJobs = useMemo(() => {
    let results = [...mockListings]
    if (query) {
      const q = query.toLowerCase()
      results = results.filter(
        j =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.tags.some(t => t.toLowerCase().includes(q)),
      )
    }
    if (selectedRegions.length > 0) {
      results = results.filter(j => selectedRegions.includes(j.region))
    }
    if (remoteOnly) {
      results = results.filter(j => j.workMode === 'Remote')
    }
    if (seniority !== 'all') {
      results = results.filter(j => j.seniority === seniority)
    }
    results.sort((a, b) => {
      if (sortBy === 'score') return b.matchScore - a.matchScore
      return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime()
    })
    return results
  }, [query, selectedRegions, remoteOnly, seniority, sortBy])

  function handleSave(job: SearchListing) {
    const isSaved = savedJobs.has(job.id)

    if (isSaved) {
      // Optimistic UI update
      setSavedJobs(prev => {
        const next = new Set(prev)
        next.delete(job.id)
        return next
      })
      setHistoryStatuses(prev => {
        const next = new Map(prev)
        next.delete(job.id)
        return next
      })
      // Remove from history (only if status is 'saved'; use case handles guard)
      removeHistoryEntry(historyRepository, job.id).catch(console.error)
    } else {
      // Optimistic UI update
      setSavedJobs(prev => new Set(prev).add(job.id))
      setHistoryStatuses(prev => new Map(prev).set(job.id, 'saved'))
      // Persist to history repo
      const entry = createHistoryEntry({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        region: job.region,
      })
      addHistoryEntry(historyRepository, entry).catch(console.error)
    }
  }

  async function handleGenerate(job: SearchListing) {
    if (generatingJobId) return
    setGeneratingJobId(job.id)
    try {
      const cvs = await listBaseCvs(cvRepository)
      if (cvs.length === 0) {
        console.warn('No base CV found — create one in CV Base first')
        return
      }
      const baseCv = cvs[0]
      const jobPosting = searchListingToJobPosting(job)
      const { tailoredData, gaps, suggestions } = await aiClient.tailorCv(baseCv, jobPosting)

      const tailored: TailoredCv = {
        id: crypto.randomUUID(),
        baseCvId: baseCv.id,
        jobPostingId: job.id,
        tailoredData,
        gaps,
        suggestions,
        guardrailsApplied: true,
        createdAt: new Date(),
      }

      setTailoredCvs(prev => new Map(prev).set(job.id, tailored))
      setHistoryStatuses(prev => new Map(prev).set(job.id, 'generated'))

      // Persist history first (uses LocalStorageHistoryRepository — always succeeds)
      if (!savedJobs.has(job.id)) {
        const entry = createHistoryEntry({
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          region: job.region,
          status: 'generated',
        })
        await addHistoryEntry(historyRepository, entry)
        setSavedJobs(prev => new Set(prev).add(job.id))
      } else {
        await updateHistoryStatus(historyRepository, job.id, 'generated')
      }

      // Best-effort: persist the tailored CV so HistoryPage can download without re-generating.
      // Uses SupabaseTailoredCvRepository in Supabase mode — may throw for non-UUID jobIds.
      try {
        await tailoredCvRepository.save(tailored)
      } catch {
        // Non-critical — history entry already saved; export will re-generate on-the-fly if needed
      }
    } catch (err) {
      console.error('Generation failed:', err)
    } finally {
      setGeneratingJobId(null)
    }
  }

  async function handleExport(job: SearchListing) {
    const tailored = tailoredCvs.get(job.id)
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

  function clearFilters() {
    setQuery('')
    setSelectedRegions([])
    setRemoteOnly(false)
    setSeniority('all')
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* ── Left panel: filters + results ── */}
      <div className="flex flex-col lg:w-[440px] xl:w-[480px] lg:border-r border-border lg:shrink-0">
        <div className="border-b border-border p-4">
          <FilterBar
            query={query}
            onQueryChange={setQuery}
            selectedRegions={selectedRegions}
            onRegionsChange={setSelectedRegions}
            remoteOnly={remoteOnly}
            onRemoteOnlyChange={setRemoteOnly}
            seniority={seniority}
            onSeniorityChange={setSeniority}
            onClear={clearFilters}
          />
        </div>

        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Loading…' : `${filteredJobs.length} results`}
          </span>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortField)}>
              <SelectTrigger className="h-7 w-[110px] border-none bg-transparent text-xs shadow-none p-0 pl-1 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Match score</SelectItem>
                <SelectItem value="date">Date posted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <SkeletonList count={6} />
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title="No jobs found"
              description="Try adjusting your filters or search query to find more results."
            >
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  isSaved={savedJobs.has(job.id)}
                  onSelect={setSelectedJob}
                  onSave={handleSave}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: job detail (desktop) ── */}
      <div className="hidden lg:flex flex-1 flex-col bg-card">
        <JobDetailPanel
          job={selectedJob}
          isSaved={selectedJob ? savedJobs.has(selectedJob.id) : false}
          historyStatus={selectedJob ? (historyStatuses.get(selectedJob.id) ?? null) : null}
          tailoredCv={selectedJob ? (tailoredCvs.get(selectedJob.id) ?? null) : null}
          isGenerating={selectedJob?.id === generatingJobId}
          isExporting={selectedJob?.id === exportingJobId}
          exportFormat={settings.exportFormat}
          onSave={handleSave}
          onGenerate={handleGenerate}
          onExport={handleExport}
        />
      </div>

      {/* ── Mobile: bottom sheet ── */}
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
                Close
              </Button>
            </div>
            <div className="h-full overflow-y-auto pb-20">
              <JobDetailPanel
                job={selectedJob}
                isSaved={savedJobs.has(selectedJob.id)}
                historyStatus={historyStatuses.get(selectedJob.id) ?? null}
                tailoredCv={tailoredCvs.get(selectedJob.id) ?? null}
                isGenerating={selectedJob.id === generatingJobId}
                isExporting={selectedJob.id === exportingJobId}
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
