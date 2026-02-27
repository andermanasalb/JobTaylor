import {
  MapPin,
  Calendar,
  ExternalLink,
  Bookmark,
  Scissors,
  Building2,
  Globe,
  AlertCircle,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/lib/utils'
import type { SearchListing } from '../types/SearchListing'
import type { HistoryStatus } from '@/features/history/domain/HistoryEntry'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { ExportFormat } from '@/features/settings/domain/AppSettings'

interface JobDetailPanelProps {
  job: SearchListing | null
  isSaved?: boolean
  historyStatus: HistoryStatus | null
  tailoredCv: TailoredCv | null
  isGenerating: boolean
  isExporting: boolean
  exportFormat: ExportFormat
  onSave?: (job: SearchListing) => void
  onGenerate: (job: SearchListing) => void
  onExport: (job: SearchListing) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreColor(score: number) {
  if (score >= 85) return 'bg-green-500/15 text-green-700 dark:text-green-400'
  if (score >= 70) return 'bg-primary/15 text-primary'
  return 'bg-muted text-muted-foreground'
}

export function JobDetailPanel({
  job,
  isSaved,
  historyStatus,
  tailoredCv,
  isGenerating,
  isExporting,
  exportFormat,
  onSave,
  onGenerate,
  onExport,
}: JobDetailPanelProps) {
  if (!job) {
    return (
      <div className="flex items-center justify-center h-full text-center px-6">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mx-auto mb-3">
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Select a job posting</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click on a result to preview details here
          </p>
        </div>
      </div>
    )
  }

  // Determine generate button label and state
  const hasGenerated = !!tailoredCv
  const canExport = hasGenerated
  const generateLabel = hasGenerated ? 'Regenerate CV' : 'Generate tailored CV'
  const GenerateIcon = hasGenerated ? RefreshCw : Scissors

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground leading-tight">
              {job.title}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{job.company}</span>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
              scoreColor(job.matchScore),
            )}
          >
            {job.matchScore}% match
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(job.postedDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {job.source}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge variant={job.workMode === 'Remote' ? 'default' : 'secondary'}>
            {job.workMode}
          </Badge>
          <Badge variant="outline">{job.seniority}</Badge>
          {job.tags.map(tag => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>

        {/* History status pill */}
        {historyStatus && historyStatus !== 'saved' && (
          <div className="mt-3">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                historyStatus === 'exported'
                  ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {historyStatus === 'generated' ? 'CV generated' : 'CV exported'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {/* Generate / Regenerate */}
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => onGenerate(job)}
            disabled={isGenerating || isExporting}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <GenerateIcon className="h-3.5 w-3.5 mr-1.5" />
                {generateLabel}
              </>
            )}
          </Button>

          {/* Export — only shown when a tailored CV exists */}
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onExport(job)}
              disabled={isExporting || isGenerating}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export {exportFormat.toUpperCase()}
                </>
              )}
            </Button>
          )}

          {/* Bookmark */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onSave?.(job)}
          >
            <Bookmark
              className={cn('h-3.5 w-3.5 mr-1.5', isSaved && 'fill-primary text-primary')}
            />
            {isSaved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {job.description ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Description
            </h3>
            <p className="text-sm text-foreground leading-relaxed">{job.description}</p>
          </section>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">No description available</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You can paste the job description manually when tailoring your CV.
              </p>
            </div>
          </div>
        )}

        {job.requirements.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Requirements
            </h3>
            <ul className="space-y-1.5">
              {job.requirements.map((req, i) => (
                <li key={i} className="text-sm text-foreground leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60" />
                  {req}
                </li>
              ))}
            </ul>
          </section>
        )}

        {job.niceToHave.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Nice to have
            </h3>
            <ul className="space-y-1.5">
              {job.niceToHave.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {job.techStack.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Tech stack
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {job.techStack.map(tech => (
                <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>
              ))}
            </div>
          </section>
        )}

        {job.notes && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Notes
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed italic">{job.notes}</p>
          </section>
        )}

        {/* Gaps / suggestions from generated CV */}
        {tailoredCv && tailoredCv.gaps.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Skill gaps identified
            </h3>
            <ul className="space-y-1.5">
              {tailoredCv.gaps.map((gap, i) => (
                <li key={i} className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500/60" />
                  {gap}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
