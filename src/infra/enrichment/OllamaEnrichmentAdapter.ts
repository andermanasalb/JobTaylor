import type { JobEnrichmentPort, EnrichedJob } from '../../features/job-postings/application/ports/JobEnrichmentPort'

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'

/**
 * Llama al proxy local (proxy/server.cjs) que a su vez:
 *  1. Hace fetch de la URL de la oferta (server-side, sin CORS)
 *  2. Extrae el texto limpio del HTML
 *  3. Llama a Ollama para generar el resumen estructurado
 */
export class OllamaEnrichmentAdapter implements JobEnrichmentPort {
  async enrich(url: string): Promise<EnrichedJob> {
    const res = await fetch(`${PROXY_URL}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error ?? `Proxy error ${res.status}`)
    }

    const data = await res.json() as EnrichedJob
    return data
  }
}
