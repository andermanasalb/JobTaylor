import { describe, it, expect } from 'vitest'
import { createBaseCv } from './BaseCv'

describe('createBaseCv', () => {
  const validInput = {
    personalInfo: { fullName: 'Ana García', email: 'ana@example.com' },
  }

  it('creates a BaseCv with required fields and sensible defaults', () => {
    const cv = createBaseCv(validInput)

    expect(cv.personalInfo.fullName).toBe('Ana García')
    expect(cv.personalInfo.email).toBe('ana@example.com')
    expect(cv.id).toBeDefined()
    expect(cv.id.length).toBeGreaterThan(0)
    expect(cv.name).toBe('My CV')
    expect(cv.summary).toBe('')
    expect(cv.experience).toEqual([])
    expect(cv.education).toEqual([])
    expect(cv.skills).toEqual([])
    expect(cv.languages).toEqual([])
    expect(cv.links).toEqual([])
    expect(cv.createdAt).toBeInstanceOf(Date)
    expect(cv.updatedAt).toBeInstanceOf(Date)
  })

  it('accepts optional fields', () => {
    const cv = createBaseCv({
      personalInfo: { fullName: 'Ana García', email: 'ana@example.com', phone: '+34 600 000 000' },
      name: 'Senior Dev CV',
      summary: 'Experienced developer',
      skills: [{ name: 'TypeScript', level: 'expert' }],
      languages: [{ name: 'Spanish', level: 'Native' }, { name: 'English', level: 'C1' }],
    })

    expect(cv.name).toBe('Senior Dev CV')
    expect(cv.summary).toBe('Experienced developer')
    expect(cv.skills).toHaveLength(1)
    expect(cv.languages).toHaveLength(2)
    expect(cv.personalInfo.phone).toBe('+34 600 000 000')
  })

  it('uses provided id when given', () => {
    const cv = createBaseCv({ ...validInput, id: 'my-fixed-id' })
    expect(cv.id).toBe('my-fixed-id')
  })

  it('generates unique ids for each call', () => {
    const cv1 = createBaseCv(validInput)
    const cv2 = createBaseCv(validInput)
    expect(cv1.id).not.toBe(cv2.id)
  })

  it('throws if fullName is empty', () => {
    expect(() =>
      createBaseCv({ personalInfo: { fullName: '', email: 'ana@example.com' } }),
    ).toThrow('BaseCv: fullName is required')
  })

  it('throws if fullName is whitespace only', () => {
    expect(() =>
      createBaseCv({ personalInfo: { fullName: '   ', email: 'ana@example.com' } }),
    ).toThrow('BaseCv: fullName is required')
  })

  it('throws if email is empty', () => {
    expect(() =>
      createBaseCv({ personalInfo: { fullName: 'Ana García', email: '' } }),
    ).toThrow('BaseCv: email is required')
  })
})
