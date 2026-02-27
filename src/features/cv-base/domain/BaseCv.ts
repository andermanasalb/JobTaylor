export interface PersonalInfo {
  fullName: string
  email: string
  phone?: string
  location?: string
  title?: string // e.g. "Senior Frontend Developer"
}

export interface Experience {
  id: string
  title: string
  company: string
  location?: string
  startDate: string // "YYYY-MM"
  endDate?: string // undefined = present
  description: string[]
  technologies?: string[]
}

export interface Education {
  id: string
  degree: string
  institution: string
  location?: string
  startDate: string // "YYYY-MM"
  endDate?: string
  description?: string
}

export interface Skill {
  name: string
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  category?: string
}

export interface Language {
  name: string
  level: string // e.g. 'Native', 'C1', 'B2', 'Fluent'
}

export interface Link {
  label: string
  url: string
}

export interface BaseCv {
  id: string
  name: string // name for this CV variant, e.g. "Main CV"
  personalInfo: PersonalInfo
  summary: string
  experience: Experience[]
  education: Education[]
  skills: Skill[]
  languages: Language[]
  links: Link[]
  createdAt: Date
  updatedAt: Date
}

export type CreateBaseCvInput = {
  id?: string
  name?: string
  personalInfo: Pick<PersonalInfo, 'fullName' | 'email'> & Partial<Omit<PersonalInfo, 'fullName' | 'email'>>
  summary?: string
  experience?: Experience[]
  education?: Education[]
  skills?: Skill[]
  languages?: Language[]
  links?: Link[]
}

export function createBaseCv(input: CreateBaseCvInput): BaseCv {
  if (!input.personalInfo.fullName?.trim()) {
    throw new Error('BaseCv: fullName is required')
  }
  if (!input.personalInfo.email?.trim()) {
    throw new Error('BaseCv: email is required')
  }

  const now = new Date()
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name ?? 'My CV',
    personalInfo: input.personalInfo,
    summary: input.summary ?? '',
    experience: input.experience ?? [],
    education: input.education ?? [],
    skills: input.skills ?? [],
    languages: input.languages ?? [],
    links: input.links ?? [],
    createdAt: now,
    updatedAt: now,
  }
}
