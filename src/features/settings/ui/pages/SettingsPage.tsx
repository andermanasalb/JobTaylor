import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/shared/i18n/i18n'
import { Cpu, Cloud, Globe, FileOutput, Layout, Shield, UserCircle, X, Copy, Check } from 'lucide-react'
import type { AppSettings, CvTemplate, ExportFormat, OutputLanguage } from '@/features/settings/domain/AppSettings'
import { defaultSettings } from '@/features/settings/domain/AppSettings'
import { PHOTO_STORAGE_KEY } from '@/features/settings/ui/hooks/usePhoto'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Slider } from '@/shared/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'jobtaylor-settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function loadPhoto(): string | undefined {
  try {
    return localStorage.getItem(PHOTO_STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** Resize an image data URL to max `maxPx` on its longest side, returns JPEG base64 */
function resizeImage(dataUrl: string, maxPx = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export function SettingsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [showCloudDialog, setShowCloudDialog] = useState(false)
  const [showLocalDialog, setShowLocalDialog] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | undefined>(loadPhoto)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      const resized = await resizeImage(dataUrl, 300)
      try {
        localStorage.setItem(PHOTO_STORAGE_KEY, resized)
      } catch {
        // quota exceeded — silently ignore
      }
      setPhoto(resized)
    }
    reader.readAsDataURL(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  function handlePhotoRemove() {
    try {
      localStorage.removeItem(PHOTO_STORAGE_KEY)
    } catch {
      // ignore
    }
    setPhoto(undefined)
  }

  function update(patch: Partial<AppSettings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      // Cambiar idioma de la UI si cambió outputLanguage
      if (patch.outputLanguage !== undefined) {
        i18n.changeLanguage(patch.outputLanguage === 'EN' ? 'en' : 'es')
      }
      // Notifica a otros componentes montados (ej. SearchPage) que el setting cambió
      window.dispatchEvent(new Event('jobtaylor-settings-changed'))
      return next
    })
  }

  function handleAiModeClick(mode: 'local' | 'cloud') {
    if (mode === settings.aiMode) return
    if (mode === 'cloud') {
      setShowCloudDialog(true)
    } else {
      setShowLocalDialog(true)
    }
  }

  function confirmCloud() {
    update({ aiMode: 'cloud' })
    setShowCloudDialog(false)
  }

  function confirmLocal() {
    update({ aiMode: 'local' })
    setShowLocalDialog(false)
  }

  function copyCmd(cmd: string) {
    navigator.clipboard.writeText(cmd).catch(() => {})
    setCopiedCmd(cmd)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4 md:px-6">
        <h1 className="text-lg font-semibold text-foreground">{t('settings.title')}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* AI Processing Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cpu className="h-4 w-4 text-primary" />
                {t('settings.aiMode.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('settings.aiMode.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleAiModeClick('local')}
                  className={cn(
                    'flex-1 rounded-lg border-2 p-4 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    settings.aiMode === 'local'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu className="h-4 w-4 text-foreground" />
                    <span className="text-sm font-medium text-foreground">{t('settings.aiMode.local')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.aiMode.localDesc')}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleAiModeClick('cloud')}
                  className={cn(
                    'flex-1 rounded-lg border-2 p-4 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    settings.aiMode === 'cloud'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Cloud className="h-4 w-4 text-foreground" />
                    <span className="text-sm font-medium text-foreground">{t('settings.aiMode.cloud')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.aiMode.cloudDesc')}
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Output Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-primary" />
                {t('settings.outputLanguage.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('settings.outputLanguage.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={settings.outputLanguage}
                onValueChange={v => update({ outputLanguage: v as OutputLanguage })}
              >
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EN">English</SelectItem>
                  <SelectItem value="ES">Español</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* CV Template */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layout className="h-4 w-4 text-primary" />
                {t('settings.template.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('settings.template.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {(['modern', 'classic', 'minimal'] as CvTemplate[]).map(tmpl => (
                  <button
                    key={tmpl}
                    type="button"
                    onClick={() => update({ template: tmpl })}
                    className={cn(
                      'flex-1 rounded-lg border-2 p-3 text-center transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      settings.template === tmpl
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30',
                    )}
                  >
                    <div className="h-16 rounded-md bg-muted mb-2 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground capitalize">{tmpl}</span>
                    </div>
                    <span className="text-xs font-medium text-foreground capitalize">{tmpl}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tailoring Strictness */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                {t('settings.strictness.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('settings.strictness.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Slider
                  value={[settings.strictness]}
                  onValueChange={([v]) => update({ strictness: v })}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('settings.strictness.creative')}</span>
                  <span className="font-medium text-foreground tabular-nums">{settings.strictness}%</span>
                  <span>{t('settings.strictness.strict')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileOutput className="h-4 w-4 text-primary" />
                {t('settings.exportFormat.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('settings.exportFormat.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={settings.exportFormat}
                onValueChange={v => update({ exportFormat: v as ExportFormat })}
              >
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="docx">DOCX</SelectItem>
                  <SelectItem value="md">Markdown</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Profile Photo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserCircle className="h-4 w-4 text-primary" />
                {t('settings.photo.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('settings.photo.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {photo ? (
                <div className="flex items-center gap-4">
                  <img
                    src={photo}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border border-border"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={handlePhotoRemove}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('settings.photo.remove')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border py-8">
                  <UserCircle className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">{t('settings.photo.noPhoto')}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('settings.photo.upload')}
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Cloud confirmation dialog */}
      <AlertDialog open={showCloudDialog} onOpenChange={setShowCloudDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.dialogs.cloudTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.dialogs.cloudDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('settings.dialogs.keepLocal')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloud}>{t('settings.dialogs.switchCloud')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Local (Ollama) setup dialog */}
      <AlertDialog open={showLocalDialog} onOpenChange={setShowLocalDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              {t('settings.dialogs.localTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-foreground">
                <p className="text-muted-foreground">
                  {t('settings.dialogs.localDesc')}
                </p>

                <ol className="space-y-3 list-none">
                  {/* Paso 1 */}
                  <li className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{t('settings.dialogs.localStep1')}</span>
                    <a
                      href="https://ollama.com/download"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 text-xs"
                    >
                      ollama.com/download
                    </a>
                  </li>

                  {/* Paso 2 */}
                  <li className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{t('settings.dialogs.localStep2')}</span>
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                      <span className="flex-1">ollama pull llama3.2</span>
                      <button
                        type="button"
                        onClick={() => copyCmd('ollama pull llama3.2')}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={t('settings.dialogs.copyCmd')}
                      >
                        {copiedCmd === 'ollama pull llama3.2'
                          ? <Check className="h-3.5 w-3.5 text-green-500" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </li>

                  {/* Paso 3 */}
                  <li className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{t('settings.dialogs.localStep3')}</span>
                    <p className="text-xs text-muted-foreground">{t('settings.dialogs.localStep3Hint')}</p>
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                      <span className="flex-1">npm run proxy</span>
                      <button
                        type="button"
                        onClick={() => copyCmd('npm run proxy')}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={t('settings.dialogs.copyCmd')}
                      >
                        {copiedCmd === 'npm run proxy'
                          ? <Check className="h-3.5 w-3.5 text-green-500" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.dialogs.localStep3Note')}
                    </p>
                  </li>
                </ol>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => update({ aiMode: 'cloud' })}>
              {t('settings.dialogs.cancelUseCloud')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLocal}>
              {t('settings.dialogs.useLocal')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
