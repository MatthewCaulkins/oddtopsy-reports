import type { Submission } from '@/payload-types'

export type VersionDoc = {
  id: string | number
  parent?: string | number
  latest?: boolean | null
  updatedAt?: string
  createdAt?: string
  version?: Partial<Submission>
}

export type VersionField =
  | 'title'
  | 'subtitle'
  | 'abstract'
  | 'focusArea'
  | 'keywords'
  | 'findingDate'
  | 'location'
  | 'mediaNotes'
  | 'seoTitle'
  | 'seoDescription'
  | 'featuredImage'
  | 'publishedDate'
  | 'featured'
  | 'correspondingAuthor'
  | 'leadAuthor'
  | 'coAuthors'
  | 'submissionType'
  | 'manuscriptPDF'
  | 'manuscriptBody'
  | 'supportingImages'
  | 'authorMessage'
  | 'workflowStatus'

export type VersionChange = {
  field: VersionField
  label: string
  before: unknown
  after: unknown
}

const fieldLabels: Record<VersionField, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  abstract: 'Abstract',
  focusArea: 'Focus Areas',
  keywords: 'Keywords',
  findingDate: 'Finding Date',
  location: 'Location',
  mediaNotes: 'Media Notes',
  seoTitle: 'SEO Title',
  seoDescription: 'SEO Description',
  featuredImage: 'Featured Image',
  publishedDate: 'Published Date',
  featured: 'Featured',
  correspondingAuthor: 'Corresponding Author',
  leadAuthor: 'Lead Author',
  coAuthors: 'Co-authors',
  submissionType: 'Submission Type',
  manuscriptPDF: 'Manuscript PDF',
  manuscriptBody: 'Manuscript Body',
  supportingImages: 'Supporting Images',
  authorMessage: 'Author Message',
  workflowStatus: 'Workflow Status',
}

export const trackedVersionFields = Object.keys(fieldLabels) as VersionField[]

function getRelationshipID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof value.id === 'string' || typeof value.id === 'number')
  ) {
    return value.id
  }

  return null
}

function normalizeRelationshipArray(value: unknown): Array<string | number> {
  if (!Array.isArray(value)) return []

  return value.map(getRelationshipID).filter((item): item is string | number => item !== null)
}

function normalizeValue(field: VersionField, value: unknown): unknown {
  switch (field) {
    case 'featuredImage':
    case 'manuscriptPDF':
      return getRelationshipID(value)

    case 'focusArea':
      return normalizeRelationshipArray(value)

    case 'keywords':
      return Array.isArray(value)
        ? value.map((item) =>
            item && typeof item === 'object' && 'keyword' in item ? String(item.keyword ?? '') : '',
          )
        : []

    case 'supportingImages':
      return Array.isArray(value)
        ? value.map((item) => {
            if (!item || typeof item !== 'object') return item

            return {
              image: 'image' in item ? getRelationshipID(item.image) : null,
              caption: 'caption' in item ? String(item.caption ?? '') : '',
            }
          })
        : []

    default:
      return value ?? null
  }
}

function valuesMatch(field: VersionField, before: unknown, after: unknown): boolean {
  return (
    JSON.stringify(normalizeValue(field, before)) === JSON.stringify(normalizeValue(field, after))
  )
}

export function getVersionChanges(
  previous: Partial<Submission> | undefined,
  current: Partial<Submission> | undefined,
): VersionChange[] {
  if (!current) return []

  return trackedVersionFields.flatMap((field) => {
    const rawBefore = previous?.[field]
    const rawAfter = current[field]

    if (valuesMatch(field, rawBefore, rawAfter)) {
      return []
    }

    return [
      {
        field,
        label: fieldLabels[field],
        before: rawBefore,
        after: rawAfter,
      },
    ]
  })
}

export function formatVersionDate(value: string) {
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
