export type JobSource = 'linkedin' | 'infojobs' | 'indeed'

export type JobStatus = 'saved' | 'applied' | 'interviewing' | 'rejected' | 'accepted' | 'discarded'

export interface JobRequirements {
  skills: string[]
  experienceYears?: number
  education?: string
  languages?: string[]
  other?: string[]
}

export interface Salary {
  min?: number
  max?: number
  currency?: string
  period?: 'yearly' | 'monthly'
}

export interface JobPosting {
  id: string
  title: string
  company: string
  location: string
  remote?: boolean
  source: JobSource
  sourceUrl?: string
  sourceJobId?: string // ID on the source platform (e.g. LinkedIn job ID)
  description: string
  requirements: JobRequirements
  salary?: Salary
  status: JobStatus
  postedAt?: Date
  createdAt: Date
  savedAt: Date
}

export type CreateJobPostingInput = {
  id?: string
  title: string
  company: string
  location?: string
  remote?: boolean
  source: JobSource
  sourceUrl?: string
  sourceJobId?: string
  description: string
  requirements?: Partial<JobRequirements>
  salary?: Salary
  status?: JobStatus
  postedAt?: Date
}

export function createJobPosting(input: CreateJobPostingInput): JobPosting {
  if (!input.title?.trim()) throw new Error('JobPosting: title is required')
  if (!input.company?.trim()) throw new Error('JobPosting: company is required')
  if (!input.description?.trim()) throw new Error('JobPosting: description is required')

  const now = new Date()
  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    company: input.company.trim(),
    location: input.location ?? '',
    remote: input.remote,
    source: input.source,
    sourceUrl: input.sourceUrl,
    sourceJobId: input.sourceJobId,
    description: input.description.trim(),
    requirements: {
      skills: input.requirements?.skills ?? [],
      experienceYears: input.requirements?.experienceYears,
      education: input.requirements?.education,
      languages: input.requirements?.languages,
      other: input.requirements?.other,
    },
    salary: input.salary,
    status: input.status ?? 'saved',
    postedAt: input.postedAt,
    createdAt: now,
    savedAt: now,
  }
}
