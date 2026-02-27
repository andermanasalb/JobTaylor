import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppDeps } from '@/app/AppDepsContext'
import { listBaseCvs } from '../../application/usecases/ListBaseCvs'
import { saveBaseCv } from '../../application/usecases/SaveBaseCv'
import type { BaseCv } from '../../domain/BaseCv'
import type { CreateBaseCvInput } from '../../domain/BaseCv'
import { CvForm } from '../components/CvForm'
import { useSettings } from '@/features/settings/ui/hooks/useSettings'
import { usePhoto } from '@/features/settings/ui/hooks/usePhoto'
import { exportBaseCv } from '@/infra/export/exportBaseCv'
import { useAuth } from '@/features/auth/ui/context/AuthContext'

export function CvBasePage() {
  const { cvRepository } = useAppDeps()
  const settings = useSettings()
  const photo = usePhoto()
  const { session } = useAuth()

  // undefined = still loading, null = loaded but no CV exists yet
  const [cv, setCv] = useState<BaseCv | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const cvs = await listBaseCvs(cvRepository)
    if (cvs.length > 0) {
      setCv(cvs[0])
      return
    }
    // No CV yet — auto-create one pre-filled with the user's registration data
    if (session?.user) {
      const initial = await saveBaseCv(cvRepository, {
        name: 'Mi CV',
        personalInfo: {
          fullName: session.user.name ?? '',
          email: session.user.email,
        },
      })
      setCv(initial)
    } else {
      setCv(null)
    }
  }, [cvRepository, session])

  useEffect(() => {
    load()
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [load])

  async function handleExport(input: CreateBaseCvInput) {
    setSaving(true)
    setSaveStatus('idle')
    try {
      await saveBaseCv(cvRepository, input)
      const cvs = await listBaseCvs(cvRepository)
      const saved = cvs[0] ?? null
      setCv(saved)
      if (saved) {
        await exportBaseCv(saved, {
          format: settings.exportFormat,
          template: settings.template,
          photo,
        })
      }
      setSaveStatus('saved')
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleAutoSave(input: CreateBaseCvInput) {
    try {
      await saveBaseCv(cvRepository, input)
      const cvs = await listBaseCvs(cvRepository)
      setCv(cvs[0] ?? null)
    } catch {
      // silent — auto-save failures don't interrupt the user
    }
  }

  if (cv === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0">
        <CvForm
          initial={cv ?? undefined}
          onSave={handleExport}
          onAutoSave={handleAutoSave}
          saving={saving}
          saveStatus={saveStatus}
          submitLabel={`Export ${settings.exportFormat.toUpperCase()}`}
        />
      </div>
    </div>
  )
}
