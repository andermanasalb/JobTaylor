import { describe, it, expect } from 'vitest'
import { FakeScoringAdapter } from './FakeScoringAdapter'

describe('FakeScoringAdapter', () => {
  it('returns a score of 72 regardless of input', async () => {
    const adapter = new FakeScoringAdapter()
    const result = await adapter.score('some cv text', 'some job description')
    expect(result.score).toBe(72)
  })

  it('returns a score in the valid range [0, 100]', async () => {
    const adapter = new FakeScoringAdapter()
    const result = await adapter.score('', '')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('implements the ScoringPort interface (score is a number)', async () => {
    const adapter = new FakeScoringAdapter()
    const result = await adapter.score('cv', 'job')
    expect(typeof result.score).toBe('number')
  })
})
