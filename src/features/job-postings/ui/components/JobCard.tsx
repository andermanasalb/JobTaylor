import { MapPin, Calendar, Bookmark, ExternalLink } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/lib/utils'
import type { SearchListing } from '../types/SearchListing'

interface JobCardProps {
  job: SearchListing
  isSelected?: boolean
  isSaved?: boolean
  score?: number | null
  onSelect?: (job: SearchListing) => void
  onSave?: (job: SearchListing) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scoreColor(score: number) {
  if (score >= 85) return 'bg-green-500/15 text-green-700 dark:text-green-400'
  if (score >= 70) return 'bg-primary/15 text-primary'
  return 'bg-muted text-muted-foreground'
}

export function JobCard({ job, isSelected, isSaved, score, onSelect, onSave }: JobCardProps) {
  const displayScore = score ?? job.matchScore
  return (
    <button
      type="button"
      onClick={() => onSelect?.(job)}
      className={cn(
        'w-full text-left rounded-lg border p-4 transition-all',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        isSelected
          ? 'border-primary/40 bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-border hover:bg-accent/30',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-card-foreground truncate leading-relaxed">
            {job.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>
        </div>
        <span
          className={cn(
            'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            scoreColor(displayScore),
          )}
        >
          {displayScore}%
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {job.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(job.postedDate)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={job.workMode === 'Remote' ? 'default' : 'secondary'}
            className="text-[10px] px-1.5 py-0 h-5"
          >
            {job.workMode}
          </Badge>
          {job.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={e => { e.stopPropagation(); onSave?.(job) }}
            aria-label={isSaved ? 'Unsave posting' : 'Save posting'}
          >
            <Bookmark
              className={cn(
                'h-3.5 w-3.5',
                isSaved ? 'fill-primary text-primary' : 'text-muted-foreground',
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={e => e.stopPropagation()}
            aria-label="Abrir oferta original"
            asChild
            disabled={!job.url}
          >
            <a
              href={job.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir oferta original"
              onClick={e => { if (!job.url) e.preventDefault(); e.stopPropagation() }}
            >
              <ExternalLink className={`h-3.5 w-3.5 ${job.url ? 'text-muted-foreground' : 'text-muted-foreground/30'}`} />
            </a>
          </Button>
        </div>
      </div>
    </button>
  )
}
