import type { ScoringPort, ScoreResult } from './ScoringPort'

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'

/**
 * Calls the local proxy /score endpoint with provider='ollama'.
 * Sends a plain-text CV preview and job description; receives { score }.
 */
export class OllamaScoringAdapter implements ScoringPort {
  async score(cvPreview: string, jobDescription: string): Promise<ScoreResult> {
    const res = await fetch(`${PROXY_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvPreview, jobDescription, provider: 'ollama' }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error ?? `Proxy error ${res.status}`)
    }

    const data = await res.json() as { score: number }
    return { score: data.score }
  }
}
