import { useState, useRef, useEffect, type FormEvent } from 'react'
import {
  Plus,
  Trash2,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Languages,
  Link2,
  ExternalLink,
  FileText,
  ArrowLeft,
  Download,
  Upload,
  X,
} from 'lucide-react'
import type { BaseCv, Skill } from '../../domain/BaseCv'
import type { CreateBaseCvInput } from '../../domain/BaseCv'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Separator } from '@/shared/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Label } from '@/shared/components/ui/label'
// ---------------------------------------------------------------------------
// Text extraction helpers (PDF via pdfjs-dist, DOCX via mammoth)
// ---------------------------------------------------------------------------

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  // Use the bundled worker from pdfjs-dist
  const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }
  return pages.join('\n')
}

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return extractTextFromPdf(file)
  if (ext === 'docx') return extractTextFromDocx(file)
  // Plain text fallback
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve((e.target?.result as string) ?? '')
    reader.onerror = reject
    reader.readAsText(file)
  })
}

const PROXY_URL = import.meta.env.VITE_PROXY_URL ?? 'http://localhost:3001'

// ---------------------------------------------------------------------------
// Form-friendly intermediate types (strings everywhere for controlled inputs)
// ---------------------------------------------------------------------------

interface ExpItem {
  id: string
  title: string
  company: string
  location: string
  startDate: string
  endDate: string
  description: string // newline-separated bullets
  technologies: string // comma-separated
}

interface EduItem {
  id: string
  degree: string
  institution: string
  location: string
  startDate: string
  endDate: string
  description: string
}

interface SkillItem {
  id: string
  name: string
  level: string
  category: string
}

interface LangItem {
  id: string
  name: string
  level: string
}

interface LinkItem {
  id: string
  label: string
  url: string
}

interface FormState {
  name: string
  fullName: string
  email: string
  phone: string
  location: string
  title: string
  summary: string
  experience: ExpItem[]
  education: EduItem[]
  skills: SkillItem[]
  languages: LangItem[]
  links: LinkItem[]
}

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

function uid() {
  return crypto.randomUUID()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function domainToForm(cv: BaseCv): FormState {
  return {
    name: cv.name,
    fullName: cv.personalInfo.fullName,
    email: cv.personalInfo.email,
    phone: cv.personalInfo.phone ?? '',
    location: cv.personalInfo.location ?? '',
    title: cv.personalInfo.title ?? '',
    summary: cv.summary,
    experience: cv.experience.map(e => ({
      id: e.id,
      title: e.title,
      company: e.company,
      location: e.location ?? '',
      startDate: e.startDate,
      endDate: e.endDate ?? '',
      description: e.description.join('\n'),
      technologies: (e.technologies ?? []).join(', '),
    })),
    education: cv.education.map(e => ({
      id: e.id,
      degree: e.degree,
      institution: e.institution,
      location: e.location ?? '',
      startDate: e.startDate,
      endDate: e.endDate ?? '',
      description: e.description ?? '',
    })),
    skills: cv.skills.map(s => ({
      id: uid(),
      name: s.name,
      level: s.level ?? '',
      category: s.category ?? '',
    })),
    languages: cv.languages.map(l => ({ id: uid(), name: l.name, level: l.level })),
    links: cv.links.map(l => ({ id: uid(), label: l.label, url: l.url })),
  }
}

export function formToDomain(form: FormState, existingId?: string): CreateBaseCvInput {
  return {
    id: existingId,
    name: form.name || 'My CV',
    personalInfo: {
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || undefined,
      location: form.location || undefined,
      title: form.title || undefined,
    },
    summary: form.summary,
    experience: form.experience.map(e => ({
      id: e.id,
      title: e.title,
      company: e.company,
      location: e.location || undefined,
      startDate: e.startDate,
      endDate: e.endDate || undefined,
      description: e.description
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
      technologies: e.technologies
        ? e.technologies
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : undefined,
    })),
    education: form.education.map(e => ({
      id: e.id,
      degree: e.degree,
      institution: e.institution,
      location: e.location || undefined,
      startDate: e.startDate,
      endDate: e.endDate || undefined,
      description: e.description || undefined,
    })),
    skills: form.skills
      .filter(s => s.name.trim())
      .map(s => ({
        name: s.name.trim(),
        level: (s.level as Skill['level']) || undefined,
        category: s.category || undefined,
      })),
    languages: form.languages
      .filter(l => l.name.trim())
      .map(l => ({ name: l.name.trim(), level: l.level })),
    links: form.links
      .filter(l => l.label.trim() && l.url.trim())
      .map(l => ({ label: l.label.trim(), url: l.url.trim() })),
  }
}

function emptyForm(): FormState {
  return {
    name: '',
    fullName: '',
    email: '',
    phone: '',
    location: '',
    title: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
    languages: [],
    links: [],
  }
}

// ---------------------------------------------------------------------------
// CvForm component
// ---------------------------------------------------------------------------

interface CvFormProps {
  initial?: BaseCv
  onSave: (input: CreateBaseCvInput) => Promise<void>
  onAutoSave?: (input: CreateBaseCvInput) => void
  saving?: boolean
  saveStatus?: 'idle' | 'saved'
  onBack?: () => void
  submitLabel?: string
}

export function CvForm({ initial, onSave, onAutoSave, saving = false, saveStatus = 'idle', onBack, submitLabel = 'Save' }: CvFormProps) {
  const [form, setForm] = useState<FormState>(() =>
    initial ? domainToForm(initial) : emptyForm(),
  )
  const [activeTab, setActiveTab] = useState('editor')
  const [skillInput, setSkillInput] = useState('')

  // ── Refs: always hold the latest values to avoid stale closures on unmount ──
  const formRef = useRef(form)
  const onAutoSaveRef = useRef(onAutoSave)
  const initialIdRef = useRef(initial?.id)

  useEffect(() => { formRef.current = form }, [form])
  useEffect(() => { onAutoSaveRef.current = onAutoSave }, [onAutoSave])
  useEffect(() => { initialIdRef.current = initial?.id }, [initial?.id])

  // ── Auto-save: debounce 800ms while the user is actively editing ──
  useEffect(() => {
    if (!onAutoSave || !form.fullName || !form.email) return
    const timer = setTimeout(() => {
      onAutoSave(formToDomain(form, initial?.id))
    }, 800)
    return () => clearTimeout(timer)
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save on unmount: fires when the user navigates away ──
  useEffect(() => {
    return () => {
      const f = formRef.current
      if (onAutoSaveRef.current && f.fullName && f.email) {
        onAutoSaveRef.current(formToDomain(f, initialIdRef.current))
      }
    }
  }, []) // empty deps — cleanup runs only on unmount

  // ── Upload tab state ──
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadText, setUploadText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generic field setter
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // ---------------------------------------------------------------------------
  // Experience helpers
  // ---------------------------------------------------------------------------
  function addExp() {
    set('experience', [
      ...form.experience,
      { id: uid(), title: '', company: '', location: '', startDate: '', endDate: '', description: '', technologies: '' },
    ])
  }
  function updateExp(id: string, field: keyof ExpItem, value: string) {
    set('experience', form.experience.map(e => (e.id === id ? { ...e, [field]: value } : e)))
  }
  function removeExp(id: string) {
    set('experience', form.experience.filter(e => e.id !== id))
  }

  // ---------------------------------------------------------------------------
  // Education helpers
  // ---------------------------------------------------------------------------
  function addEdu() {
    set('education', [
      ...form.education,
      { id: uid(), degree: '', institution: '', location: '', startDate: '', endDate: '', description: '' },
    ])
  }
  function updateEdu(id: string, field: keyof EduItem, value: string) {
    set('education', form.education.map(e => (e.id === id ? { ...e, [field]: value } : e)))
  }
  function removeEdu(id: string) {
    set('education', form.education.filter(e => e.id !== id))
  }

  // ---------------------------------------------------------------------------
  // Skills helpers
  // ---------------------------------------------------------------------------
  function addSkill(name: string) {
    const trimmed = name.trim()
    if (!trimmed || form.skills.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) return
    set('skills', [...form.skills, { id: uid(), name: trimmed, level: '', category: '' }])
  }
  function removeSkill(id: string) {
    set('skills', form.skills.filter(s => s.id !== id))
  }

  // ---------------------------------------------------------------------------
  // Languages helpers
  // ---------------------------------------------------------------------------
  function addLang() {
    set('languages', [...form.languages, { id: uid(), name: '', level: '' }])
  }
  function updateLang(id: string, field: keyof LangItem, value: string) {
    set('languages', form.languages.map(l => (l.id === id ? { ...l, [field]: value } : l)))
  }
  function removeLang(id: string) {
    set('languages', form.languages.filter(l => l.id !== id))
  }

  // ---------------------------------------------------------------------------
  // Links helpers
  // ---------------------------------------------------------------------------
  function addLink() {
    set('links', [...form.links, { id: uid(), label: '', url: '' }])
  }
  function updateLink(id: string, field: keyof LinkItem, value: string) {
    set('links', form.links.map(l => (l.id === id ? { ...l, [field]: value } : l)))
  }
  function removeLink(id: string) {
    set('links', form.links.filter(l => l.id !== id))
  }

  // ---------------------------------------------------------------------------
  // Upload helpers
  // ---------------------------------------------------------------------------
  function handleFileSelect(file: File) {
    setUploadedFile(file)
    setParseError(null)
    // Eagerly extract text from all supported formats so the paste area mirrors the content
    extractText(file)
      .then(text => setUploadText(text))
      .catch(() => { /* user can still paste manually */ })
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleParse() {
    const text = uploadText.trim()
    if (!text) {
      setParseError('Pega o sube el texto de tu CV antes de parsear.')
      return
    }
    setParsing(true)
    setParseError(null)
    try {
      const response = await fetch(`${PROXY_URL}/parse-cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error((errData as { error?: string }).error ?? `Error ${response.status}`)
      }
      const parsed = await response.json() as {
        fullName?: string
        email?: string
        phone?: string | null
        location?: string | null
        title?: string | null
        summary?: string | null
        experience?: { title?: string; company?: string; location?: string | null; startDate?: string; endDate?: string | null; description?: string[]; technologies?: string[] }[]
        education?: { degree?: string; institution?: string; location?: string | null; startDate?: string | null; endDate?: string | null; description?: string | null }[]
        skills?: { name?: string; level?: string | null; category?: string | null }[]
        languages?: { name?: string; level?: string }[]
        links?: { label?: string; url?: string }[]
      }

      // Normaliza un valor: si es null/undefined/vacío devuelve ''
      const s = (val: string | null | undefined) =>
        (val != null && val.trim() !== '') ? val.trim() : ''

      // Reemplaza el formulario completo con lo parseado (vacía lo anterior)
      setForm({
        name: '',   // el usuario lo pondrá al guardar
        fullName: s(parsed.fullName),
        email: s(parsed.email),
        phone: s(parsed.phone),
        location: s(parsed.location),
        title: s(parsed.title),
        summary: s(parsed.summary),
        experience: Array.isArray(parsed.experience)
          ? parsed.experience.map(e => ({
              id: uid(),
              title: s(e.title),
              company: s(e.company),
              location: s(e.location),
              startDate: s(e.startDate),
              endDate: s(e.endDate),
              description: Array.isArray(e.description)
                ? e.description.join('\n')
                : s(e.description as unknown as string),
              technologies: Array.isArray(e.technologies)
                ? e.technologies.join(', ')
                : s(e.technologies as unknown as string),
            }))
          : [],
        education: Array.isArray(parsed.education)
          ? parsed.education.map(e => ({
              id: uid(),
              degree: s(e.degree),
              institution: s(e.institution),
              location: s(e.location),
              startDate: s(e.startDate),
              endDate: s(e.endDate),
              description: s(e.description),
            }))
          : [],
        skills: Array.isArray(parsed.skills)
          ? parsed.skills
              .filter(sk => sk.name && sk.name.trim())
              .map(sk => ({ id: uid(), name: s(sk.name), level: s(sk.level), category: s(sk.category) }))
          : [],
        languages: Array.isArray(parsed.languages)
          ? parsed.languages
              .filter(l => l.name && l.name.trim())
              .map(l => ({ id: uid(), name: s(l.name), level: s(l.level) }))
          : [],
        links: Array.isArray(parsed.links)
          ? parsed.links
              .filter(l => l.url && l.url.trim())
              .map(l => ({ id: uid(), label: s(l.label), url: s(l.url) }))
          : [],
      })
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error al parsear el CV. ¿Está el proxy corriendo en localhost:3001?')
    } finally {
      setParsing(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSave(formToDomain(form, initial?.id))
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {onBack && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={onBack}
                aria-label="Back to CVs"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold truncate">{form.fullName || form.name || <span className="text-muted-foreground font-normal">New CV</span>}</p>
              {form.title && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{form.title}</p>
              )}
            </div>
          </div>
          <Button type="submit" size="sm" className="text-xs shrink-0 gap-1.5" disabled={saving}>
            {!saving && saveStatus !== 'saved' && submitLabel !== 'Save' && (
              <Download className="h-3.5 w-3.5" />
            )}
            {saving
              ? (submitLabel !== 'Save' ? 'Exporting…' : 'Saving…')
              : saveStatus === 'saved'
              ? (submitLabel !== 'Save' ? 'Done ✓' : 'Saved ✓')
              : submitLabel}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border px-4 md:px-6">
          <TabsList className="h-9 bg-transparent p-0 gap-4">
            {(['editor', 'preview', 'upload'] as const).map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-9 rounded-none border-none px-0 pb-2 pt-2 text-xs font-medium capitalize bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none data-[state=active]:font-bold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── EDITOR TAB ── */}
        <TabsContent value="editor" className="flex-1 overflow-y-auto p-4 md:p-6 mt-0">
          <div className="mx-auto max-w-2xl space-y-6">

            {/* Personal Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-primary" />
                  Personal Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Full name *</Label>
                    <Input
                      value={form.fullName}
                      onChange={e => set('fullName', e.target.value)}
                      placeholder="Ana García"
                      className="text-sm h-8"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="ana@example.com"
                      className="text-sm h-8"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="+34 600 000 000"
                      className="text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Location</Label>
                    <Input
                      value={form.location}
                      onChange={e => set('location', e.target.value)}
                      placeholder="Madrid, Spain"
                      className="text-sm h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Professional title</Label>
                  <Input
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder="Senior Frontend Developer"
                    className="text-sm h-8"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={form.summary}
                  onChange={e => set('summary', e.target.value)}
                  rows={4}
                  className="text-sm resize-none"
                  placeholder="Write a professional summary..."
                />
              </CardContent>
            </Card>

            {/* Experience */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Experience
                  </CardTitle>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addExp}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.experience.map(exp => (
                  <div key={exp.id} className="group relative rounded-lg border border-border p-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input value={exp.title} onChange={e => updateExp(exp.id, 'title', e.target.value)} placeholder="Job title" className="text-sm h-8" />
                      <Input value={exp.company} onChange={e => updateExp(exp.id, 'company', e.target.value)} placeholder="Company" className="text-sm h-8" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input value={exp.startDate} onChange={e => updateExp(exp.id, 'startDate', e.target.value)} placeholder="Start (YYYY-MM)" className="text-sm h-8" />
                      <Input value={exp.endDate} onChange={e => updateExp(exp.id, 'endDate', e.target.value)} placeholder="End (YYYY-MM or Present)" className="text-sm h-8" />
                    </div>
                    <Input value={exp.location} onChange={e => updateExp(exp.id, 'location', e.target.value)} placeholder="Location (optional)" className="text-sm h-8 mb-3" />
                    <Textarea
                      value={exp.description}
                      onChange={e => updateExp(exp.id, 'description', e.target.value)}
                      placeholder="One bullet point per line..."
                      rows={3}
                      className="text-sm resize-none mb-3"
                    />
                    <Input value={exp.technologies} onChange={e => updateExp(exp.id, 'technologies', e.target.value)} placeholder="Technologies (comma-separated)" className="text-sm h-8" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => removeExp(exp.id)}
                      aria-label="Remove experience"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {form.experience.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No experience added yet</p>
                )}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    Education
                  </CardTitle>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addEdu}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.education.map(edu => (
                  <div key={edu.id} className="group relative rounded-lg border border-border p-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input value={edu.degree} onChange={e => updateEdu(edu.id, 'degree', e.target.value)} placeholder="Degree" className="text-sm h-8" />
                      <Input value={edu.institution} onChange={e => updateEdu(edu.id, 'institution', e.target.value)} placeholder="Institution" className="text-sm h-8" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input value={edu.startDate} onChange={e => updateEdu(edu.id, 'startDate', e.target.value)} placeholder="Start (YYYY-MM)" className="text-sm h-8" />
                      <Input value={edu.endDate} onChange={e => updateEdu(edu.id, 'endDate', e.target.value)} placeholder="End (YYYY-MM)" className="text-sm h-8" />
                    </div>
                    <Input value={edu.location} onChange={e => updateEdu(edu.id, 'location', e.target.value)} placeholder="Location (optional)" className="text-sm h-8 mb-3" />
                    <Input value={edu.description} onChange={e => updateEdu(edu.id, 'description', e.target.value)} placeholder="Details (optional)" className="text-sm h-8" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => removeEdu(edu.id)}
                      aria-label="Remove education"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {form.education.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No education added yet</p>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Code className="h-4 w-4 text-primary" />
                  Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.skills.map(skill => (
                    <Badge
                      key={skill.id}
                      variant="secondary"
                      className="text-xs cursor-pointer group/skill"
                      onClick={() => removeSkill(skill.id)}
                    >
                      {skill.name}
                      <span className="ml-1 opacity-40 group-hover/skill:opacity-100">×</span>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addSkill(skillInput)
                        setSkillInput('')
                      }
                    }}
                    placeholder="Add a skill and press Enter..."
                    className="text-sm h-8 flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => { addSkill(skillInput); setSkillInput('') }}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Languages */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Languages className="h-4 w-4 text-primary" />
                    Languages
                  </CardTitle>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addLang}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {form.languages.map(lang => (
                  <div key={lang.id} className="group flex items-center gap-2">
                    <Input value={lang.name} onChange={e => updateLang(lang.id, 'name', e.target.value)} placeholder="Language" className="text-sm h-8 flex-1" />
                    <Input value={lang.level} onChange={e => updateLang(lang.id, 'level', e.target.value)} placeholder="Level (e.g. C1, Native)" className="text-sm h-8 flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeLang(lang.id)}
                      aria-label="Remove language"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {form.languages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No languages added yet</p>
                )}
              </CardContent>
            </Card>

            {/* Links */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Link2 className="h-4 w-4 text-primary" />
                    Links
                  </CardTitle>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addLink}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {form.links.map(link => (
                  <div key={link.id} className="group flex items-center gap-2">
                    <Input value={link.label} onChange={e => updateLink(link.id, 'label', e.target.value)} placeholder="Label (e.g. LinkedIn)" className="text-sm h-8 w-32 shrink-0" />
                    <Input value={link.url} onChange={e => updateLink(link.id, 'url', e.target.value)} placeholder="https://..." className="text-sm h-8 flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeLink(link.id)}
                      aria-label="Remove link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {form.links.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No links added yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── PREVIEW TAB ── */}
        <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 md:p-6 mt-0">
          <div className="mx-auto max-w-2xl">
            <CvPreview form={form} />
          </div>
        </TabsContent>

        {/* ── UPLOAD TAB ── */}
        <TabsContent value="upload" className="flex-1 overflow-y-auto p-4 md:p-6 mt-0">
          <div className="mx-auto max-w-2xl space-y-6">

            {/* Drop zone — hidden once a file is loaded */}
            {!uploadedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Arrastra tu CV aquí o haz clic para subir</p>
                  <p className="text-xs text-muted-foreground mt-1">Compatible con TXT, PDF, DOCX</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                    e.target.value = ''
                  }}
                />
              </div>
            ) : (
              /* File card — shown after a file is loaded */
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => { setUploadedFile(null); setUploadText('') }}
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Separator */}
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">o</span>
              <Separator className="flex-1" />
            </div>

            {/* Paste area */}
            <div className="space-y-2">
              <Label className="text-xs">Pega el texto de tu CV</Label>
              <Textarea
                value={uploadText}
                onChange={e => setUploadText(e.target.value)}
                rows={12}
                className="text-sm resize-none font-mono"
                placeholder="Pega aquí el texto completo de tu CV…"
              />
            </div>

            {parseError && (
              <p className="text-xs text-destructive">{parseError}</p>
            )}

            <Button
              type="button"
              className="w-full"
              disabled={parsing || !uploadText.trim()}
              onClick={handleParse}
            >
              {parsing ? 'Analizando con IA…' : 'Parsear e importar'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Ollama analizará tu CV y rellenará el Editor. Revisa y ajusta antes de guardar.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Read-only preview
// ---------------------------------------------------------------------------

function CvPreview({ form }: { form: FormState }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 md:p-8 shadow-sm space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">{form.fullName || '—'}</h2>
        {form.title && <p className="text-sm text-primary mt-0.5">{form.title}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
          {form.email && <span>{form.email}</span>}
          {form.phone && <span>{form.phone}</span>}
          {form.location && <span>{form.location}</span>}
        </div>
        {form.links.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-1">
            {form.links.map(l => (
              <span key={l.id} className="text-xs text-primary inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {form.summary && (
        <>
          <Separator />
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</h3>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{form.summary}</p>
          </section>
        </>
      )}

      {form.experience.length > 0 && (
        <>
          <Separator />
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Experience</h3>
            </div>
            <div className="space-y-4">
              {form.experience.map(exp => (
                <div key={exp.id}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      {exp.title || '—'}
                      {exp.company && <span className="font-normal text-muted-foreground"> at {exp.company}</span>}
                    </h4>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {exp.startDate}{exp.endDate ? ` – ${exp.endDate}` : exp.startDate ? ' – Present' : ''}
                    </span>
                  </div>
                  {exp.location && <p className="text-xs text-muted-foreground mb-1">{exp.location}</p>}
                  {exp.description && (
                    <ul className="space-y-0.5 mt-1">
                      {exp.description.split('\n').filter(Boolean).map((bullet, i) => (
                        <li key={i} className="text-xs text-foreground leading-relaxed flex items-start gap-1.5">
                          <span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-primary/50" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                  {exp.technologies && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {exp.technologies.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {form.education.length > 0 && (
        <>
          <Separator />
          <section>
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Education</h3>
            </div>
            <div className="space-y-2">
              {form.education.map(edu => (
                <div key={edu.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-medium text-foreground">{edu.degree || '—'}</h4>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {edu.startDate}{edu.endDate ? ` – ${edu.endDate}` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {edu.institution}{edu.location ? `, ${edu.location}` : ''}{edu.description ? ` — ${edu.description}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {form.skills.length > 0 && (
        <>
          <Separator />
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skills</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.skills.map(skill => (
                <Badge key={skill.id} variant="secondary" className="text-xs">{skill.name}</Badge>
              ))}
            </div>
          </section>
        </>
      )}

      {form.languages.length > 0 && (
        <>
          <Separator />
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Languages className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Languages</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.languages.map(lang => (
                <Badge key={lang.id} variant="outline" className="text-xs">
                  {lang.name}{lang.level ? ` — ${lang.level}` : ''}
                </Badge>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
