import type { AiClient, AiTailorResult } from '../../features/tailoring/application/ports/AiClient'
import type { BaseCv } from '../../features/cv-base/domain/BaseCv'
import type { JobPosting } from '../../features/job-postings/domain/JobPosting'

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'

/**
 * Llama al proxy local /tailor con provider='gemini' para generar un CV
 * adaptado usando la API de Gemini.
 * Respeta los guardrails: nunca inventa experiencia, empresas ni fechas.
 * El nivel de creatividad se controla con el parámetro strictness (0-100).
 */
export class GeminiAiClient implements AiClient {
  strictness: number
  enrichedDescription: string | undefined
  language: string

  constructor(strictness = 70, enrichedDescription?: string, language = 'ES') {
    this.strictness = strictness
    this.enrichedDescription = enrichedDescription
    this.language = language
  }

  async tailorCv(baseCv: BaseCv, jobPosting: JobPosting): Promise<AiTailorResult> {
    const res = await fetch(`${PROXY_URL}/tailor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cv: baseCv,
        jobTitle: jobPosting.title,
        jobDescription: jobPosting.description,
        enrichedDescription: this.enrichedDescription,
        strictness: this.strictness,
        language: this.language,
        provider: 'gemini',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error ?? `Proxy /tailor error ${res.status}`)
    }

    const data = await res.json()

    // Defensive merge: for each field we prefer the AI result when non-empty/non-null;
    // otherwise we fall back to the original baseCv to avoid data loss.
    const ai = data.tailoredCv ?? {}

    function mergeArray<T>(aiArr: unknown, baseArr: T[]): T[] {
      return Array.isArray(aiArr) && (aiArr as T[]).length > 0 ? (aiArr as T[]) : baseArr
    }

    // personalInfo can be spread flat by Gemini or nested — handle both
    const aiPersonal = ai.personalInfo ?? ai
    const mergedPersonalInfo = {
      fullName: aiPersonal.fullName ?? baseCv.personalInfo.fullName,
      email: aiPersonal.email ?? baseCv.personalInfo.email,
      phone: aiPersonal.phone ?? baseCv.personalInfo.phone,
      location: aiPersonal.location ?? baseCv.personalInfo.location,
      title: aiPersonal.title ?? baseCv.personalInfo.title,
    }

    const tailoredData: BaseCv = {
      id: baseCv.id,
      name: baseCv.name,
      personalInfo: mergedPersonalInfo,
      summary: typeof ai.summary === 'string' && ai.summary.trim() ? ai.summary : baseCv.summary,
      experience: mergeArray(ai.experience, baseCv.experience),
      education: mergeArray(ai.education, baseCv.education),
      skills: mergeArray(ai.skills, baseCv.skills),
      languages: mergeArray(ai.languages, baseCv.languages),
      links: mergeArray(ai.links, baseCv.links),
      createdAt: baseCv.createdAt,
      updatedAt: new Date(),
    }

    return {
      tailoredData,
      gaps: Array.isArray(data.gaps) ? data.gaps : [],
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    }
  }
}
