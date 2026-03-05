import { describe, it, expect } from 'vitest'
import { cvToPlainText } from './cvToPlainText'
import { createBaseCv } from './BaseCv'

describe('cvToPlainText', () => {
  it('includes the candidate full name', () => {
    const cv = createBaseCv({ personalInfo: { fullName: 'Ana García', email: 'ana@example.com' } })
    const text = cvToPlainText(cv)
    expect(text).toContain('Ana García')
  })

  it('includes the professional title when present', () => {
    const cv = createBaseCv({
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com', title: 'Senior Frontend Developer' },
    })
    const text = cvToPlainText(cv)
    expect(text).toContain('Senior Frontend Developer')
  })

  it('includes the summary', () => {
    const cv = createBaseCv({
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      summary: 'Experienced engineer with 10 years in web development.',
    })
    const text = cvToPlainText(cv)
    expect(text).toContain('Experienced engineer with 10 years in web development.')
  })

  it('includes experience with role, company, and period', () => {
    const cv = createBaseCv({
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      experience: [{
        id: '1',
        title: 'Tech Lead',
        company: 'Acme Corp',
        startDate: '2020-01',
        endDate: '2023-06',
        description: ['Led a team of 5 engineers'],
      }],
    })
    const text = cvToPlainText(cv)
    expect(text).toContain('Tech Lead')
    expect(text).toContain('Acme Corp')
    expect(text).toContain('2020-01')
    expect(text).toContain('Led a team of 5 engineers')
  })

  it('marks ongoing experience as "presente"', () => {
    const cv = createBaseCv({
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      experience: [{
        id: '1',
        title: 'Engineer',
        company: 'Startup',
        startDate: '2022-03',
        description: [],
      }],
    })
    const text = cvToPlainText(cv)
    expect(text).toContain('presente')
  })

  it('includes skills', () => {
    const cv = createBaseCv({
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      skills: [{ name: 'TypeScript', level: 'expert' }, { name: 'React' }],
    })
    const text = cvToPlainText(cv)
    expect(text).toContain('TypeScript')
    expect(text).toContain('React')
  })

  it('includes languages', () => {
    const cv = createBaseCv({
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
      languages: [{ name: 'Spanish', level: 'Native' }, { name: 'English', level: 'C1' }],
    })
    const text = cvToPlainText(cv)
    expect(text).toContain('Spanish: Native')
    expect(text).toContain('English: C1')
  })

  it('returns a non-empty string for a minimal CV', () => {
    const cv = createBaseCv({ personalInfo: { fullName: 'Bob', email: 'bob@example.com' } })
    const text = cvToPlainText(cv)
    expect(text.length).toBeGreaterThan(0)
  })
})
