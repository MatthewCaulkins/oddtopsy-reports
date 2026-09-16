import type { SiteContent } from '@/payload-types'

type BoardMember = NonNullable<SiteContent['editorialBoard']>[number]

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
  summary?: string[]
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
  { field: 'editorialBoard', label: 'Editorial Board' },
]

function getPhotoId(member?: BoardMember): string {
  if (!member?.photo) return ''

  return String(typeof member.photo === 'object' ? member.photo.id : member.photo)
}

function normalize(value: unknown): unknown {
  return value ?? ''
}

function normalizeEditorialBoard(board: SiteContent['editorialBoard']) {
  return (board || []).map((member) => ({
    id: member.id || null,
    photo: typeof member.photo === 'object' ? (member.photo?.id ?? null) : (member.photo ?? null),
    name: member.name || '',
    title: member.title || '',
    affiliation: member.affiliation || '',
    biography: member.biography || '',
  }))
}

function valuesEqual(field: keyof SiteContent, before: unknown, after: unknown): boolean {
  if (field === 'editorialBoard') {
    return (
      JSON.stringify(normalizeEditorialBoard(before as SiteContent['editorialBoard'])) ===
      JSON.stringify(normalizeEditorialBoard(after as SiteContent['editorialBoard']))
    )
  }

  return normalize(before) === normalize(after)
}

function getEditorialBoardChangeSummary(
  before: SiteContent['editorialBoard'],
  after: SiteContent['editorialBoard'],
): string[] {
  const beforeMembers = before || []
  const afterMembers = after || []
  const messages: string[] = []

  const beforeById = new Map(
    beforeMembers
      .filter((member) => member.id)
      .map((member, index) => [String(member.id), { member, index }]),
  )

  const afterById = new Map(
    afterMembers
      .filter((member) => member.id)
      .map((member, index) => [String(member.id), { member, index }]),
  )

  for (const [id, { member, index }] of afterById) {
    const previous = beforeById.get(id)
    const name = member.name || 'Editorial board member'

    if (!previous) {
      messages.push(`${name} added`)
      continue
    }

    if (previous.index !== index) {
      messages.push(`${name} moved from position ${previous.index + 1} to ${index + 1}`)
    }

    if (previous.member.name !== member.name) {
      messages.push(`${name} name changed`)
    }

    if (previous.member.title !== member.title) {
      messages.push(`${name} title changed`)
    }

    if (previous.member.affiliation !== member.affiliation) {
      messages.push(`${name} affiliation changed`)
    }

    if (previous.member.biography !== member.biography) {
      messages.push(`${name} biography changed`)
    }

    if (getPhotoId(previous.member) !== getPhotoId(member)) {
      messages.push(`${name} photo changed`)
    }
  }

  for (const [id, { member }] of beforeById) {
    if (!afterById.has(id)) {
      messages.push(`${member.name || 'Editorial board member'} removed`)
    }
  }

  return messages
}

export function getSiteContentVersionChanges(
  previous?: SiteContent,
  current?: SiteContent,
): SiteContentChange[] {
  if (!current) return []

  const changes: SiteContentChange[] = []

  for (const { field, label } of trackedFields) {
    const before = previous?.[field]
    const after = current[field]

    if (valuesEqual(field, before, after)) continue

    changes.push({
      field,
      label,
      before,
      after,
      ...(field === 'editorialBoard' && {
        summary: getEditorialBoardChangeSummary(
          before as SiteContent['editorialBoard'],
          after as SiteContent['editorialBoard'],
        ),
      }),
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
