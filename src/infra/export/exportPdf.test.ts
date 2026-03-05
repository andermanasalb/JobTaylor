import { describe, it, expect } from 'vitest'
import { generateCvPdfBlob } from './exportPdf'
import type { TailoredCv } from '@/features/tailoring/domain/TailoredCv'
import type { BaseCv } from '@/features/cv-base/domain/BaseCv'

const baseCv: BaseCv = {
  id: 'cv-1',
  name: 'My CV',
  personalInfo: {
    fullName: 'Ana García',
    email: 'ana@example.com',
    phone: '+34 600 000 000',
    location: 'Madrid, Spain',
    title: 'Senior Frontend Developer',
  },
  summary: 'Experienced frontend developer with 5 years building web apps.',
  experience: [
    {
      id: 'exp-1',
      title: 'Frontend Developer',
      company: 'TechCorp',
      location: 'Madrid',
      startDate: '2020-01',
      endDate: '2023-06',
      description: ['Built React apps', 'Improved performance by 40%'],
      technologies: ['React', 'TypeScript'],
    },
  ],
  education: [
    {
      id: 'edu-1',
      degree: "Bachelor's in Computer Science",
      institution: 'Universidad Complutense',
      startDate: '2015-09',
      endDate: '2019-06',
    },
  ],
  skills: [{ name: 'React' }, { name: 'TypeScript' }],
  languages: [{ name: 'Spanish', level: 'Native' }, { name: 'English', level: 'C1' }],
  links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/anagarcia' }],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const tailoredCv: TailoredCv = {
  id: 'tailored-1',
  baseCvId: 'cv-1',
  jobPostingId: 'job-1',
  jobTitle: 'Senior Frontend Developer',
  jobDescription: 'Build great web applications with React.',
  score: null,
  tailoredData: {
    ...baseCv,
    summary: 'Experienced frontend developer applying for Senior role at Acme.',
  },
  gaps: ['GraphQL'],
  suggestions: ['Consider highlighting any GraphQL experience.'],
  guardrailsApplied: true,
  createdAt: new Date('2024-01-01'),
}

describe('generateCvPdfBlob', () => {
  it('returns a Blob', async () => {
    const blob = await generateCvPdfBlob(tailoredCv)
    expect(blob).toBeInstanceOf(Blob)
  })

  it('returns a non-empty Blob', async () => {
    const blob = await generateCvPdfBlob(tailoredCv)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('returns a PDF MIME type', async () => {
    const blob = await generateCvPdfBlob(tailoredCv)
    expect(blob.type).toBe('application/pdf')
  })

  it('does not throw for a minimal CV (no experience, no skills)', async () => {
    const minimal: TailoredCv = {
      ...tailoredCv,
      tailoredData: {
        ...baseCv,
        summary: '',
        experience: [],
        education: [],
        skills: [],
        languages: [],
        links: [],
      },
    }
    await expect(generateCvPdfBlob(minimal)).resolves.toBeInstanceOf(Blob)
  })
})
