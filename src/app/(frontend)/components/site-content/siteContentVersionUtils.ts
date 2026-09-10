import type { SiteContent } from '@/payload-types'

export type SiteContentVersionDoc = {
  id: string | number
  createdAt?: string | null
  updatedAt?: string | null
  version: SiteContent
}

export type SiteContentChange = {
  field: keyof SiteContent
  label: string
  before: unknown
  after: unknown
}

const trackedFields: {
  field: keyof SiteContent
  label: string
}[] = [
  { field: 'heroTitle', label: 'Page title' },
  { field: 'heroBody', label: 'Introduction' },
  { field: 'content', label: 'Page content' },
  { field: 'secondaryTitle', label: 'Secondary title' },
  { field: 'secondaryContent', label: 'Secondary content' },
]

function normalize(value: unknown): unknown {
  return value ?? ''
}

export function getSiteContentVersionChanges(
  previous?: SiteContent,
  current?: SiteContent,
): SiteContentChange[] {
  if (!current) return []

  const changes: SiteContentChange[] = []

  for (const { field, label } of trackedFields) {
    const before = normalize(previous?.[field])
    const after = normalize(current[field])

    if (before === after) continue

    changes.push({
      field,
      label,
      before,
      after,
    })
  }

  return changes
}

export function formatSiteContentVersionDate(value?: string | null) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(new Date(value))
}
