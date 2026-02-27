import { useState, type FormEvent } from 'react'
import type { JobPosting, CreateJobPostingInput, JobSource, JobStatus } from '../../domain/JobPosting'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Briefcase, MapPin, Link2, FileText } from 'lucide-react'

// ---------------------------------------------------------------------------
// Form-friendly intermediate type
// ---------------------------------------------------------------------------

interface FormState {
  title: string
  company: string
  location: string
  remote: boolean
  source: JobSource
  sourceUrl: string
  description: string
  status: JobStatus
}

function emptyForm(): FormState {
  return {
    title: '',
    company: '',
    location: '',
    remote: false,
    source: 'linkedin',
    sourceUrl: '',
    description: '',
    status: 'saved',
  }
}

export function domainToForm(posting: JobPosting): FormState {
  return {
    title: posting.title,
    company: posting.company,
    location: posting.location,
    remote: posting.remote ?? false,
    source: posting.source,
    sourceUrl: posting.sourceUrl ?? '',
    description: posting.description,
    status: posting.status,
  }
}

export function formToDomain(form: FormState, existingId?: string): CreateJobPostingInput {
  return {
    id: existingId,
    title: form.title,
    company: form.company,
    location: form.location || undefined,
    remote: form.remote,
    source: form.source,
    sourceUrl: form.sourceUrl || undefined,
    description: form.description,
    status: form.status,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JobPostingFormProps {
  initial?: JobPosting
  onSave: (input: CreateJobPostingInput) => Promise<void>
  saving?: boolean
}

const SOURCES: JobSource[] = ['linkedin', 'infojobs', 'indeed']
const STATUSES: JobStatus[] = ['saved', 'applied', 'interviewing', 'rejected', 'accepted', 'discarded']

export function JobPostingForm({ initial, onSave, saving = false }: JobPostingFormProps) {
  const [form, setForm] = useState<FormState>(() =>
    initial ? domainToForm(initial) : emptyForm(),
  )

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSave(formToDomain(form, initial?.id))
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">
              {initial ? 'Edit Job Posting' : 'Add Job Posting'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste the job description to save and tailor your CV later
            </p>
          </div>
          <Button type="submit" size="sm" className="text-xs shrink-0" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-5">

          {/* Basic info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-primary" />
                Job Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Job title *</Label>
                  <Input
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder="Frontend Developer"
                    className="text-sm h-8"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company *</Label>
                  <Input
                    value={form.company}
                    onChange={e => set('company', e.target.value)}
                    placeholder="Acme Corp"
                    className="text-sm h-8"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <select
                    value={form.status}
                    onChange={e => set('status', e.target.value as JobStatus)}
                    className="w-full text-sm h-8 rounded-md border border-input bg-background px-2 capitalize"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Source portal</Label>
                  <select
                    value={form.source}
                    onChange={e => set('source', e.target.value as JobSource)}
                    className="w-full text-sm h-8 rounded-md border border-input bg-background px-2 capitalize"
                  >
                    {SOURCES.map(s => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="Madrid, Spain"
                  className="text-sm h-8 flex-1"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={form.remote}
                    onChange={e => set('remote', e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Remote
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Source URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-primary" />
                Source URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={form.sourceUrl}
                onChange={e => set('sourceUrl', e.target.value)}
                placeholder="https://linkedin.com/jobs/view/..."
                className="text-sm h-8"
                type="url"
              />
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                Job Description *
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Paste the full job description here..."
                rows={14}
                className="text-sm resize-none font-mono text-xs leading-relaxed"
                required
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
