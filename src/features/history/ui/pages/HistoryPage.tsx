import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Download, ExternalLink, Search, X, Loader2, Trash2, Clock } from 'lucide-react'
import { useAppDeps } from '@/app/AppDepsContext'
import { listHistoryEntries } from '@/features/history/application/usecases/ListHistoryEntries'
import { updateHistoryStatus } from '@/features/history/application/usecases/UpdateHistoryStatus'
import type { HistoryEntry, HistoryStatus } from '@/features/history/domain/HistoryEntry'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog'
import { EmptyState } from '@/features/job-postings/ui/components/EmptyState'
import { mockListings } from '@/features/job-postings/ui/mock/searchMock'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import { listBaseCvs } from '@/features/cv-base/application/usecases/ListBaseCvs'
import { exportTailoredCv } from '@/infra/export/exportTailoredCv'
import { useSettings } from '@/features/settings/ui/hooks/useSettings'
import { usePhoto } from '@/features/settings/ui/hooks/usePhoto'
import { searchListingToJobPosting } from '@/features/job-postings/ui/utils/searchListingAdapter'
import { useGenerationQueue } from '@/shared/context/GenerationQueueContext'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DisplayStatus = HistoryStatus | 'pending' | 'generating'

function StatusPill({ status }: { status: DisplayStatus }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
        <Clock className="h-3 w-3" />
        En cola
      </span>
    )
  }
  if (status === 'generating') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        Generando
      </span>
    )
  }
  if (status === 'generated') {
    return (
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', 'bg-primary/10 text-primary')}>
        CV generado
      </span>
    )
  }
  if (status === 'exported') {
    return (
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', 'bg-green-500/15 text-green-700 dark:text-green-400')}>
        CV exportado
      </span>
    )
  }
  // saved
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
      Guardada
    </span>
  )
}

function formatDate(date: Date): string {
  return (
    date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const REGIONS = ['País Vasco', 'Madrid', 'Barcelona', 'Remote (EU)'] as const

export function HistoryPage() {
  const { historyRepository, cvRepository, aiClient, tailoredCvRepository } = useAppDeps()
  const settings = useSettings()
  const photo = usePhoto()
  const generationQueue = useGenerationQueue()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<HistoryStatus | 'all'>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    listHistoryEntries(historyRepository)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [historyRepository])

  const filtered = useMemo(() => {
    let items = [...entries]

    if (query) {
      const q = query.toLowerCase()
      items = items.filter(
        h =>
          h.jobTitle.toLowerCase().includes(q) ||
          h.company.toLowerCase().includes(q),
      )
    }

    if (statusFilter !== 'all') {
      items = items.filter(h => h.status === statusFilter)
    }

    if (regionFilter !== 'all') {
      items = items.filter(h => h.region === regionFilter)
    }

    return items
  }, [entries, query, statusFilter, regionFilter])

  const hasFilters = Boolean(query) || statusFilter !== 'all' || regionFilter !== 'all'

  function clearFilters() {
    setQuery('')
    setStatusFilter('all')
    setRegionFilter('all')
  }

  async function handleDelete(entry: HistoryEntry) {
    try {
      // Force-delete regardless of status (user confirmed via dialog)
      const existing = await historyRepository.findByJobId(entry.jobId)
      if (existing) await historyRepository.delete(existing.id)
      // Update UI immediately — don't block on tailored CV cleanup
      setEntries(prev => prev.filter(e => e.id !== entry.id))
    } catch (err) {
      console.error('Delete failed:', err)
    }
    // Best-effort: also remove any persisted tailored CV for this job.
    // Runs outside the main try/catch so a Supabase error (e.g. non-UUID jobId)
    // does not prevent the UI from reflecting the deletion.
    try {
      const tailoredList = await tailoredCvRepository.findByJobPostingId(entry.jobId)
      await Promise.all(tailoredList.map(cv => tailoredCvRepository.delete(cv.id)))
    } catch {
      // Non-critical — history entry already removed from UI and storage
    }
  }

  async function handleDownload(entry: HistoryEntry) {
    if (downloadingId) return
    const listing = mockListings.find(j => j.id === entry.jobId)
    if (!listing) return
    setDownloadingId(entry.id)
    try {
      // Try to use a previously generated and persisted tailored CV first
      const cached = await tailoredCvRepository.findByJobPostingId(entry.jobId)
      const existing = cached[0] ?? null

      let tailored: TailoredCv
      if (existing) {
        tailored = existing
      } else {
        // Fall back to re-generating via AI
        const cvs = await listBaseCvs(cvRepository)
        if (cvs.length === 0) return
        const baseCv = cvs[0]
        const jobPosting = searchListingToJobPosting(listing)
        const { tailoredData, gaps, suggestions } = await aiClient.tailorCv(baseCv, jobPosting)
        tailored = {
          id: crypto.randomUUID(),
          baseCvId: baseCv.id,
          jobPostingId: listing.id,
          tailoredData,
          gaps,
          suggestions,
          guardrailsApplied: true,
          createdAt: new Date(),
        }
        // Persist so future downloads skip re-generation
        await tailoredCvRepository.save(tailored)
      }

      await exportTailoredCv(tailored, {
        format: settings.exportFormat,
        template: settings.template,
        photo,
      })
      // Advance status to exported if not already
      if (entry.status !== 'exported') {
        await updateHistoryStatus(historyRepository, entry.jobId, 'exported')
        setEntries(prev =>
          prev.map(e => e.id === entry.id ? { ...e, status: 'exported', exportedAt: new Date() } : e)
        )
      }
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4 md:px-6">
        <h1 className="text-lg font-semibold text-foreground">History</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track your saved postings and generated CV versions
        </p>
      </div>

      {/* Filters */}
      <div className="border-b border-border px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search history..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={v => setStatusFilter(v as HistoryStatus | 'all')}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="saved">Saved</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
              <SelectItem value="exported">Exported</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={regionFilter}
            onValueChange={setRegionFilter}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {REGIONS.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table / List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={entries.length === 0 ? 'No history yet' : 'No entries found'}
            description={
              entries.length === 0
                ? 'Save a job from the Search page to start tracking it here.'
                : 'No entries match your filters. Try adjusting them.'
            }
          >
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Job title</TableHead>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Region</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    <TableHead className="text-xs">Exported</TableHead>
                    <TableHead className="w-8"><span className="sr-only">View</span></TableHead>
                    <TableHead className="w-8"><span className="sr-only">Download</span></TableHead>
                    <TableHead className="w-8"><span className="sr-only">Delete</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(entry => {
                    const queueEntry = generationQueue.jobs.get(entry.jobId)
                    const effectiveStatus: DisplayStatus =
                      queueEntry?.status === 'pending' ? 'pending'
                      : queueEntry?.status === 'generating' ? 'generating'
                      : entry.status
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm font-medium">
                          <Link
                            to="/search"
                            state={{ jobId: entry.jobId }}
                            className="hover:text-primary transition-colors"
                          >
                            {entry.jobTitle}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.company}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.region}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={effectiveStatus} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(entry.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {entry.exportedAt ? formatDate(entry.exportedAt) : '—'}
                        </TableCell>
                        <TableCell className="w-8">
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link to="/search" state={{ jobId: entry.jobId }} aria-label="View job">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                        <TableCell className="w-8">
                          {entry.status !== 'saved' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Download"
                              disabled={downloadingId === entry.id}
                              onClick={() => handleDownload(entry)}
                            >
                              {downloadingId === entry.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />
                              }
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="w-8">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent size="sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminará todo el historial de <strong>{entry.jobTitle}</strong> en {entry.company}. Tendrás que volver a guardar y generar el CV si cambias de opinión.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>No</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => handleDelete(entry)}
                                >
                                  Sí, eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-3 space-y-2">
              {filtered.map(entry => {
                const queueEntry = generationQueue.jobs.get(entry.jobId)
                const effectiveStatus: DisplayStatus =
                  queueEntry?.status === 'pending' ? 'pending'
                  : queueEntry?.status === 'generating' ? 'generating'
                  : entry.status
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <Link
                          to="/search"
                          state={{ jobId: entry.jobId }}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {entry.jobTitle}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.company} — {entry.region}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <StatusPill status={effectiveStatus} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(entry.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link to="/search" state={{ jobId: entry.jobId }} aria-label="View job">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {entry.status !== 'saved' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Download"
                            disabled={downloadingId === entry.id}
                            onClick={() => handleDownload(entry)}
                          >
                            {downloadingId === entry.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Download className="h-3.5 w-3.5" />
                            }
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará todo el historial de <strong>{entry.jobTitle}</strong> en {entry.company}. Tendrás que volver a guardar y generar el CV si cambias de opinión.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>No</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => handleDelete(entry)}
                              >
                                Sí, eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
