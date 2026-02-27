import { describe, it, expect } from 'vitest'
import { createJobPosting } from './JobPosting'

describe('createJobPosting', () => {
  const validInput = {
    title: 'Frontend Developer',
    company: 'Acme Corp',
    description: 'We are looking for an experienced React developer to join our team.',
    source: 'linkedin' as const,
  }

  it('creates a JobPosting with required fields and sensible defaults', () => {
    const posting = createJobPosting(validInput)

    expect(posting.title).toBe('Frontend Developer')
    expect(posting.company).toBe('Acme Corp')
    expect(posting.description).toBe(
      'We are looking for an experienced React developer to join our team.',
    )
    expect(posting.source).toBe('linkedin')
    expect(posting.id).toBeDefined()
    expect(posting.id.length).toBeGreaterThan(0)
    expect(posting.status).toBe('saved')
    expect(posting.location).toBe('')
    expect(posting.requirements.skills).toEqual([])
    expect(posting.createdAt).toBeInstanceOf(Date)
    expect(posting.savedAt).toBeInstanceOf(Date)
  })

  it('accepts all optional fields', () => {
    const posting = createJobPosting({
      ...validInput,
      source: 'infojobs',
      location: 'Madrid, Spain',
      remote: true,
      sourceUrl: 'https://infojobs.net/job/123',
      sourceJobId: 'ij-123',
      requirements: {
        skills: ['React', 'TypeScript'],
        experienceYears: 3,
        languages: ['Spanish', 'English'],
      },
      salary: { min: 40000, max: 60000, currency: 'EUR', period: 'yearly' },
      status: 'applied',
    })

    expect(posting.source).toBe('infojobs')
    expect(posting.location).toBe('Madrid, Spain')
    expect(posting.remote).toBe(true)
    expect(posting.sourceUrl).toBe('https://infojobs.net/job/123')
    expect(posting.sourceJobId).toBe('ij-123')
    expect(posting.requirements.skills).toEqual(['React', 'TypeScript'])
    expect(posting.requirements.experienceYears).toBe(3)
    expect(posting.salary?.min).toBe(40000)
    expect(posting.status).toBe('applied')
  })

  it('uses provided id when given', () => {
    const posting = createJobPosting({ ...validInput, id: 'fixed-id' })
    expect(posting.id).toBe('fixed-id')
  })

  it('generates unique ids for each call', () => {
    const p1 = createJobPosting(validInput)
    const p2 = createJobPosting(validInput)
    expect(p1.id).not.toBe(p2.id)
  })

  it('trims whitespace from title and company', () => {
    const posting = createJobPosting({ ...validInput, title: '  Dev  ', company: '  Corp  ' })
    expect(posting.title).toBe('Dev')
    expect(posting.company).toBe('Corp')
  })

  it('throws if title is empty', () => {
    expect(() => createJobPosting({ ...validInput, title: '' })).toThrow(
      'JobPosting: title is required',
    )
  })

  it('throws if title is whitespace only', () => {
    expect(() => createJobPosting({ ...validInput, title: '   ' })).toThrow(
      'JobPosting: title is required',
    )
  })

  it('throws if company is empty', () => {
    expect(() => createJobPosting({ ...validInput, company: '' })).toThrow(
      'JobPosting: company is required',
    )
  })

  it('throws if description is empty', () => {
    expect(() => createJobPosting({ ...validInput, description: '' })).toThrow(
      'JobPosting: description is required',
    )
  })

})
