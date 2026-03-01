import type { AiClient, AiTailorResult } from '../../features/tailoring/application/ports/AiClient'
import type { BaseCv } from '../../features/cv-base/domain/BaseCv'
import type { JobPosting } from '../../features/job-postings/domain/JobPosting'

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'

/**
 * Llama al proxy local /tailor para generar un CV adaptado con Ollama.
 * Respeta los guardrails: nunca inventa experiencia, empresas ni fechas.
 * El nivel de creatividad se controla con el parámetro strictness (0-100).
 */
export class OllamaAiClient implements AiClient {
  private strictness: number
  private enrichedDescription: string | undefined
  private language: string

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
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error ?? `Proxy /tailor error ${res.status}`)
    }

    const data = await res.json()

    // Fusionar el CV tailoreado con el original para preservar campos que Ollama pueda omitir
    const tailoredData: BaseCv = {
      ...baseCv,
      ...data.tailoredCv,
      id: baseCv.id,
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
