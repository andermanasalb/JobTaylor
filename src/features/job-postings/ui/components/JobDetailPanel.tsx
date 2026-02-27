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
  Clock,
} from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/lib/utils'
import type { SearchListing } from '../types/SearchListing'
import type { HistoryStatus } from '@/features/history/domain/HistoryEntry'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { ExportFormat } from '@/features/settings/domain/AppSettings'
import type { GenerationStatus } from '@/shared/context/GenerationQueueContext'

interface JobDetailPanelProps {
  job: SearchListing | null
  isSaved?: boolean
  historyStatus: HistoryStatus | null
  tailoredCv: TailoredCv | null
  /** Estado de la cola de generación para este job */
  generationStatus: GenerationStatus | null
  isExporting: boolean
  isScoring: boolean
  score: number | null
  exportFormat: ExportFormat
  onSave?: (job: SearchListing) => void
  onGenerate: (job: SearchListing) => void
  onExport: (job: SearchListing) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreColor(score: number) {
  if (score >= 75) return 'bg-green-500/15 text-green-700 dark:text-green-400'
  if (score >= 50) return 'bg-primary/15 text-primary'
  return 'bg-muted text-muted-foreground'
}

export function JobDetailPanel({
  job,
  isSaved,
  historyStatus,
  tailoredCv,
  generationStatus,
  isExporting,
  isScoring,
  score,
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
          <p className="text-sm font-medium text-foreground">Selecciona una oferta</p>
          <p className="text-xs text-muted-foreground mt-1">
            Haz click en un resultado para ver los detalles aquí
          </p>
        </div>
      </div>
    )
  }

  const hasGenerated = !!tailoredCv
  const canExport = hasGenerated
  const isGenerating = generationStatus === 'generating'
  const isPending = generationStatus === 'pending'
  const isQueued = isGenerating || isPending
  const generateLabel = hasGenerated ? 'Regenerar CV' : 'Generar CV adaptado'
  const GenerateIcon = hasGenerated ? RefreshCw : Scissors

  // Score a mostrar: Ollama si está disponible, sino matchScore de Adzuna
  const displayScore = score ?? job.matchScore

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

          {/* Score badge */}
          {isScoring ? (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-muted text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Calculando…
            </span>
          ) : (
            <span
              className={cn(
                'shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
                scoreColor(displayScore),
              )}
            >
              {displayScore}% match
            </span>
          )}
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
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Ver oferta
            </a>
          )}
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
              {historyStatus === 'generated' ? 'CV generado' : 'CV exportado'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => onGenerate(job)}
            disabled={isQueued || isExporting}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Generando…
              </>
            ) : isPending ? (
              <>
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                En cola…
              </>
            ) : (
              <>
                <GenerateIcon className="h-3.5 w-3.5 mr-1.5" />
                {generateLabel}
              </>
            )}
          </Button>

          {canExport && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onExport(job)}
              disabled={isExporting || isQueued}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Exportando…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Exportar {exportFormat.toUpperCase()}
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onSave?.(job)}
          >
            <Bookmark
              className={cn('h-3.5 w-3.5 mr-1.5', isSaved && 'fill-primary text-primary')}
            />
            {isSaved ? 'Guardada' : 'Guardar'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Descripción de la oferta (directamente de Adzuna) */}
        {job.description ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Descripción
            </h3>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </section>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Sin descripción disponible</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Abre la oferta original para ver el detalle completo.
              </p>
            </div>
          </div>
        )}

        {/* Tags de tecnologías detectados */}
        {job.techStack.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Tecnologías detectadas
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {job.techStack.map(tech => (
                <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Gaps / sugerencias del CV generado */}
        {tailoredCv && tailoredCv.gaps.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Brechas detectadas
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

        {tailoredCv && tailoredCv.suggestions.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Sugerencias
            </h3>
            <ul className="space-y-1.5">
              {tailoredCv.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
