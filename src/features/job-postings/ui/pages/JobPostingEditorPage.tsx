import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useAppDeps } from '@/app/AppDepsContext'
import { getJobPosting } from '../../application/usecases/GetJobPosting'
import { saveJobPosting } from '../../application/usecases/SaveJobPosting'
import type { JobPosting, CreateJobPostingInput } from '../../domain/JobPosting'
import { JobPostingForm } from '../components/JobPostingForm'
import { Button } from '@/shared/components/ui/button'

export function JobPostingEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { jobPostingRepository } = useAppDeps()

  const [posting, setPosting] = useState<JobPosting | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getJobPosting(jobPostingRepository, id).then((found: JobPosting | null) => {
      if (!found) {
        setError(t('jobEditor.notFound'))
      } else {
        setPosting(found)
      }
      setLoading(false)
    })
  }, [id, jobPostingRepository])

  async function handleSave(input: CreateJobPostingInput) {
    setSaving(true)
    try {
      await saveJobPosting(jobPostingRepository, input)
      navigate('/search')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('jobEditor.saveFailed'))
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('jobEditor.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {t('jobEditor.backToJobs')}
        </Button>
      </div>
    )
  }

  return <JobPostingForm initial={posting ?? undefined} onSave={handleSave} saving={saving} />
}
