import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  Check,
  RefreshCw,
  Undo2,
  Download,
  AlertTriangle,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAppDeps } from '@/app/AppDepsContext'
import { getJobPosting } from '@/features/job-postings/application/usecases/GetJobPosting'
import { listBaseCvs } from '@/features/cv-base/application/usecases/ListBaseCvs'
import { generateTailoredCv } from '../../application/usecases/GenerateTailoredCv'
import { updateHistoryStatus } from '@/features/history/application/usecases/UpdateHistoryStatus'
import type { JobPosting } from '@/features/job-postings/domain/JobPosting'
import type { BaseCv } from '@/features/cv-base/domain/BaseCv'
import type { TailoredCv } from '../../domain/TailoredCv'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Switch } from '@/shared/components/ui/switch'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Separator } from '@/shared/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { exportTailoredCv } from '@/infra/export/exportTailoredCv'
import { useSettings } from '@/features/settings/ui/hooks/useSettings'
import { usePhoto } from '@/features/settings/ui/hooks/usePhoto'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Requirement {
  id: string
  text: string
  matched: boolean
  category: 'must' | 'nice' | 'inferred'
}

const STEPS = [
  { id: 1, label: 'Extract requirements' },
  { id: 2, label: 'Tailored CV editor' },
  { id: 3, label: 'Export' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveRequirements(job: JobPosting): Requirement[] {
  const reqs: Requirement[] = []

  job.requirements.skills.forEach((skill, i) => {
    reqs.push({
      id: `skill-${i}`,
      text: skill,
      matched: true,
      category: 'must',
    })
  })

  if (job.requirements.experienceYears) {
    reqs.push({
      id: 'exp-req',
      text: `${job.requirements.experienceYears}+ years of experience`,
      matched: true,
      category: 'must',
    })
  }

  if (job.requirements.education) {
    reqs.push({
      id: 'edu-req',
      text: job.requirements.education,
      matched: true,
      category: 'nice',
    })
  }

  // Extract bullet-point-like items from description as inferred requirements
  const lines = job.description
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 20 && l.length < 120)
    .slice(0, 4)

  lines.forEach((line, i) => {
    reqs.push({
      id: `inferred-${i}`,
      text: line,
      matched: i % 3 !== 2, // some unmatched for realistic preview
      category: 'inferred',
    })
  })

  return reqs
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function TailorPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { cvRepository, jobPostingRepository, tailoredCvRepository, aiClient, historyRepository } = useAppDeps()
  const settings = useSettings()
  const photo = usePhoto()

  const [job, setJob] = useState<JobPosting | null>(null)
  const [cvs, setCvs] = useState<BaseCv[]>([])
  const [selectedCvId, setSelectedCvId] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [requirements, setRequirements] = useState<Requirement[]>([])

  // Step 2: editor
  const [result, setResult] = useState<TailoredCv | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [tailoredSummary, setTailoredSummary] = useState('')
  const [originalSummary, setOriginalSummary] = useState('')
  const [showDiff, setShowDiff] = useState(false)

  // Step 3: export
  const [exportFormat, setExportFormat] = useState<string>(settings.exportFormat)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!jobId) return
    Promise.all([
      getJobPosting(jobPostingRepository, jobId),
      listBaseCvs(cvRepository),
    ]).then(([foundJob, foundCvs]) => {
      if (!foundJob) {
        setLoadError('Job posting not found')
        return
      }
      setJob(foundJob)
      setRequirements(deriveRequirements(foundJob))
      setCvs(foundCvs)
      if (foundCvs.length > 0) setSelectedCvId(foundCvs[0].id)
    }).catch(() => {
      setLoadError('Job posting not found')
    })
  }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleRequirement(id: string) {
    setRequirements(prev =>
      prev.map(r => (r.id === id ? { ...r, matched: !r.matched } : r))
    )
  }

  async function handleGenerate() {
    if (!jobId || !selectedCvId) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const tailored = await generateTailoredCv(
        { cvRepo: cvRepository, jobRepo: jobPostingRepository, tailoredRepo: tailoredCvRepository, aiClient },
        { cvId: selectedCvId, jobPostingId: jobId },
      )
      setResult(tailored)
      setTailoredSummary(tailored.tailoredData.summary)
      setOriginalSummary(tailored.tailoredData.summary)
      setCurrentStep(2)
      // Update history status to 'generated' (no-op if not in history)
      updateHistoryStatus(historyRepository, jobId, 'generated').catch(console.error)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleExport() {
    if (!result) return
    setExporting(true)
    try {
      const exportResult: TailoredCv = {
        ...result,
        tailoredData: {
          ...result.tailoredData,
          summary: tailoredSummary,
        },
      }
      await exportTailoredCv(exportResult, { format: exportFormat as 'pdf' | 'docx' | 'md', template: settings.template, photo })
      // Update history status to 'exported' (no-op if not in history)
      if (jobId) updateHistoryStatus(historyRepository, jobId, 'exported').catch(console.error)
    } finally {
      setExporting(false)
      setExportDialogOpen(false)
    }
  }

  const matchedCount = requirements.filter(r => r.matched).length
  const totalCount = requirements.length

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">Job not found</h3>
          <p className="text-sm text-muted-foreground">The job posting you're trying to tailor for doesn't exist.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Jobs
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Guardrail banner */}
      <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs text-foreground flex-1">
          <strong>Guardrail:</strong> Do not invent experience. Only rephrase and highlight existing skills from your base CV.
        </p>
        <Link
          to="/settings"
          className="text-xs text-primary hover:underline shrink-0 inline-flex items-center gap-1"
        >
          <Settings className="h-3 w-3" />
          Settings
        </Link>
      </div>

      {/* Header */}
      <div className="border-b border-border px-4 py-3 md:px-6">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            {job?.title ?? 'Jobs'}
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Tailor CV</span>
        </nav>
        <h1 className="text-base font-semibold text-foreground">
          {job ? `Tailoring for ${job.title} at ${job.company}` : 'Tailor CV'}
        </h1>
      </div>

      {/* Stepper */}
      <div className="border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-2 md:gap-4" role="navigation" aria-label="Tailoring steps">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2 md:gap-4">
              {i > 0 && (
                <div
                  className={cn(
                    'h-px w-4 md:w-8',
                    currentStep > i ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  // Only allow navigating to already-reached steps
                  if (step.id <= currentStep) setCurrentStep(step.id)
                  // Step 3 requires a result
                  if (step.id === 3 && !result) return
                }}
                className={cn(
                  'flex items-center gap-2 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                  currentStep === step.id
                    ? 'text-primary'
                    : currentStep > step.id
                      ? 'text-foreground cursor-pointer'
                      : 'text-muted-foreground cursor-default'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold',
                    currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : currentStep > step.id
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {currentStep > step.id ? <Check className="h-3 w-3" /> : step.id}
                </span>
                <span className="hidden md:inline">{step.label}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === 1 && (
          <Step1Requirements
            job={job}
            cvs={cvs}
            selectedCvId={selectedCvId}
            onSelectCv={setSelectedCvId}
            requirements={requirements}
            matchedCount={matchedCount}
            totalCount={totalCount}
            onToggle={toggleRequirement}
            generating={generating}
            generateError={generateError}
            onGenerate={handleGenerate}
          />
        )}
        {currentStep === 2 && result && (
          <Step2Editor
            result={result}
            tailoredSummary={tailoredSummary}
            originalSummary={originalSummary}
            onTailoredChange={setTailoredSummary}
            onReset={() => setTailoredSummary(originalSummary)}
            showDiff={showDiff}
            onShowDiffChange={setShowDiff}
            onBack={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
          />
        )}
        {currentStep === 3 && result && job && (
          <Step3Export
            job={job}
            exportFormat={exportFormat}
            onFormatChange={setExportFormat}
            exportDialogOpen={exportDialogOpen}
            onExportDialogOpenChange={setExportDialogOpen}
            exporting={exporting}
            onExport={handleExport}
            onBack={() => setCurrentStep(2)}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Extract Requirements
// ---------------------------------------------------------------------------

interface Step1Props {
  job: JobPosting | null
  cvs: BaseCv[]
  selectedCvId: string
  onSelectCv: (id: string) => void
  requirements: Requirement[]
  matchedCount: number
  totalCount: number
  onToggle: (id: string) => void
  generating: boolean
  generateError: string | null
  onGenerate: () => void
}

function Step1Requirements({
  job,
  cvs,
  selectedCvId,
  onSelectCv,
  requirements,
  matchedCount,
  totalCount,
  onToggle,
  generating,
  generateError,
  onGenerate,
}: Step1Props) {
  const grouped = {
    must: requirements.filter(r => r.category === 'must'),
    nice: requirements.filter(r => r.category === 'nice'),
    inferred: requirements.filter(r => r.category === 'inferred'),
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Extracted Requirements</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and adjust which requirements match your profile ({matchedCount}/{totalCount} matched)
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-8" disabled>
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Re-extract
        </Button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${totalCount > 0 ? (matchedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {totalCount > 0 ? (
        <div className="space-y-6">
          {(['must', 'nice', 'inferred'] as const).map(cat => {
            if (grouped[cat].length === 0) return null
            return (
              <section key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {cat === 'must'
                    ? 'Must-have requirements'
                    : cat === 'nice'
                      ? 'Nice-to-have'
                      : 'Inferred from description'}
                </h3>
                <div className="space-y-2">
                  {grouped[cat].map(req => (
                    <label
                      key={req.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        req.matched
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-card'
                      )}
                    >
                      <Checkbox
                        checked={req.matched}
                        onCheckedChange={() => onToggle(req.id)}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-foreground leading-relaxed flex-1">
                        {req.text}
                      </span>
                      <Badge
                        variant={req.matched ? 'default' : 'outline'}
                        className="text-[10px] shrink-0"
                      >
                        {req.matched ? 'Matched' : 'Unmatched'}
                      </Badge>
                    </label>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-6">
          {job ? 'No requirements extracted from this job posting.' : 'Loading job posting…'}
        </p>
      )}

      {/* CV selector */}
      {cvs.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base CV</h3>
          <select
            value={selectedCvId}
            onChange={e => onSelectCv(e.target.value)}
            className="w-full text-sm h-8 rounded-md border border-input bg-background px-2"
          >
            {cvs.map(cv => (
              <option key={cv.id} value={cv.id}>
                {cv.name} — {cv.personalInfo.fullName}
              </option>
            ))}
          </select>
        </div>
      )}

      {cvs.length === 0 && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">No base CVs found.</p>
          <Button size="sm" variant="outline" className="text-xs" asChild>
            <Link to="/cv">Create a CV first</Link>
          </Button>
        </div>
      )}

      {generateError && (
        <p className="text-xs text-destructive mt-3">{generateError}</p>
      )}

      <div className="flex justify-end mt-6">
        <Button
          size="sm"
          onClick={onGenerate}
          disabled={generating || !selectedCvId || cvs.length === 0}
        >
          {generating ? 'Generating…' : 'Continue to editor'}
          {!generating && <ChevronRight className="h-3.5 w-3.5 ml-1" />}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Tailored CV Editor
// ---------------------------------------------------------------------------

interface Step2Props {
  result: TailoredCv
  tailoredSummary: string
  originalSummary: string
  onTailoredChange: (v: string) => void
  onReset: () => void
  showDiff: boolean
  onShowDiffChange: (v: boolean) => void
  onBack: () => void
  onNext: () => void
}

function Step2Editor({
  result,
  tailoredSummary,
  originalSummary,
  onTailoredChange,
  onReset,
  showDiff,
  onShowDiffChange,
  onBack,
  onNext,
}: Step2Props) {
  const cv = result.tailoredData

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 md:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs h-7" disabled>
            <RefreshCw className="h-3 w-3 mr-1" />
            Regenerate
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onReset}>
            <Undo2 className="h-3 w-3 mr-1" />
            Undo
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="diff-toggle"
            checked={showDiff}
            onCheckedChange={onShowDiffChange}
            className="scale-75"
          />
          <Label htmlFor="diff-toggle" className="text-xs cursor-pointer">
            {showDiff ? (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> Diff view
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <EyeOff className="h-3 w-3" /> Diff off
              </span>
            )}
          </Label>
        </div>
      </div>

      {/* Split panels */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left: Base CV */}
        <div className="flex flex-col border-r border-border overflow-y-auto">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              CV Base
            </h3>
          </div>
          <div className="p-4 md:p-5 space-y-4">
            {/* Personal */}
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Personal</h4>
              <p className="text-sm font-medium">{cv.personalInfo.fullName}</p>
              {cv.personalInfo.title && (
                <p className="text-xs text-primary">{cv.personalInfo.title}</p>
              )}
              <p className="text-xs text-muted-foreground">{cv.personalInfo.email}</p>
            </section>

            <Separator />

            {/* Summary */}
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Summary</h4>
              <p className="text-sm text-foreground leading-relaxed">{originalSummary}</p>
            </section>

            {/* Experience */}
            {cv.experience.map(exp => (
              <section key={exp.id}>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                  {exp.title} at {exp.company}
                </h4>
                <p className="text-xs text-muted-foreground mb-1">
                  {exp.startDate}{exp.endDate ? ` – ${exp.endDate}` : ' – Present'}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {exp.description.map((bullet, i) => (
                    <li key={i} className="text-xs text-foreground leading-relaxed flex items-start gap-1.5">
                      <span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        {/* Right: Tailored CV */}
        <div className="flex flex-col overflow-y-auto">
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
              CV Tailored
            </h3>
          </div>
          <div className="p-4 md:p-5 space-y-4">
            {/* Personal */}
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Personal</h4>
              <p className="text-sm font-medium">{cv.personalInfo.fullName}</p>
              {cv.personalInfo.title && (
                <p className="text-xs text-primary">{cv.personalInfo.title}</p>
              )}
              <p className="text-xs text-muted-foreground">{cv.personalInfo.email}</p>
            </section>

            <Separator />

            {/* Summary — editable */}
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Summary</h4>
              <Textarea
                value={tailoredSummary}
                onChange={e => onTailoredChange(e.target.value)}
                rows={4}
                className={cn(
                  'text-sm resize-none',
                  showDiff && 'bg-primary/5 border-primary/20'
                )}
              />
            </section>

            {/* Experience */}
            {cv.experience.map(exp => (
              <section key={exp.id}>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                  {exp.title} at {exp.company}
                </h4>
                <div
                  className={cn(
                    'rounded-md border p-3',
                    showDiff ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'
                  )}
                >
                  <ul className="space-y-0.5">
                    {exp.description.map((bullet, i) => (
                      <li key={i} className="text-xs text-foreground leading-relaxed flex items-start gap-1.5">
                        <span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-primary/50" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}

            {/* Gaps (if any) */}
            {result.gaps.length > 0 && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Skill gaps
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {result.gaps.map(gap => (
                      <Badge key={gap} variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400">
                        {gap}
                      </Badge>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 md:px-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" disabled>
            Apply changes
          </Button>
          <Button size="sm" onClick={onNext}>
            Continue to export
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Export
// ---------------------------------------------------------------------------

interface Step3Props {
  job: JobPosting
  exportFormat: string
  onFormatChange: (v: string) => void
  exportDialogOpen: boolean
  onExportDialogOpenChange: (v: boolean) => void
  exporting: boolean
  onExport: () => void
  onBack: () => void
}

function Step3Export({
  job,
  exportFormat,
  onFormatChange,
  exportDialogOpen,
  onExportDialogOpenChange,
  exporting,
  onExport,
  onBack,
}: Step3Props) {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h2 className="text-sm font-semibold text-foreground mb-1">Export tailored CV</h2>
      <p className="text-xs text-muted-foreground mb-6">
        Your tailored CV for {job.title} at {job.company} is ready to export.
      </p>

      {/* Export preview card */}
      <div className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {`CV_${job.company}_${job.title.replace(/\s+/g, '_')}`}
            </p>
            <p className="text-xs text-muted-foreground">Tailored version — ready to download</p>
          </div>
        </div>

        <Separator className="mb-4" />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Format</span>
            <Select value={exportFormat} onValueChange={onFormatChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">DOCX</SelectItem>
                <SelectItem value="md">Markdown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Language</span>
            <Select defaultValue="EN">
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EN">English</SelectItem>
                <SelectItem value="ES">Spanish</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to editor
        </Button>

        <Dialog open={exportDialogOpen} onOpenChange={onExportDialogOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CV
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export tailored CV</DialogTitle>
              <DialogDescription>
                Your tailored CV will be exported as {exportFormat.toUpperCase()}.
                This will also be saved in your history.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium text-foreground mb-1">
                {job.title} at {job.company}
              </p>
              <p className="text-xs text-muted-foreground">
                Format: {exportFormat.toUpperCase()} | Language: EN
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onExportDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onExport} disabled={exporting}>
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Downloading…' : 'Download'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
