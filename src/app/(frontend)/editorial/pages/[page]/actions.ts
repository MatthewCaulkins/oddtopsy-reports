'use server'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

const allowedPages = ['papers', 'submit', 'about', 'subscribe'] as const

type SitePage = (typeof allowedPages)[number]

function isSitePage(value: string): value is SitePage {
  return allowedPages.includes(value as SitePage)
}

type EditorialBoardMemberInput = {
  id?: string
  photo?: number | null
  name: string
  title: string
  affiliation: string
  biography: string
}

function parseEditorialBoard(value: FormDataEntryValue | null): EditorialBoardMemberInput[] {
  if (typeof value !== 'string' || !value) {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('Invalid editorial board data.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid editorial board data.')
  }

  return parsed.map((member) => {
    if (!member || typeof member !== 'object') {
      throw new Error('Invalid editorial board member.')
    }

    const item = member as Record<string, unknown>

    const name = typeof item.name === 'string' ? item.name.trim() : ''

    if (!name) {
      throw new Error('Editorial board members must have a name.')
    }

    let photo: number | null = null

    if (typeof item.photo === 'number' && Number.isInteger(item.photo)) {
      photo = item.photo
    }

    return {
      ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
      photo,
      name,
      title: typeof item.title === 'string' ? item.title.trim() : '',
      affiliation: typeof item.affiliation === 'string' ? item.affiliation.trim() : '',
      biography: typeof item.biography === 'string' ? item.biography.trim() : '',
    }
  })
}

export async function updateSiteContent(formData: FormData) {
  const id = Number(formData.get('id'))
  const page = String(formData.get('page') || '')

  if (!Number.isInteger(id)) {
    throw new Error('Invalid site content ID.')
  }

  if (!isSitePage(page)) {
    throw new Error('Invalid site content page.')
  }

  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login')
  }

  const editorialBoard =
    page === 'about' ? parseEditorialBoard(formData.get('editorialBoard')) : undefined

  await payload.update({
    collection: 'site-content',
    id,
    data: {
      heroTitle: String(formData.get('heroTitle') || '').trim(),
      heroBody: String(formData.get('heroBody') || ''),
      content: String(formData.get('content') || ''),
      secondaryTitle: String(formData.get('secondaryTitle') || '').trim(),
      secondaryContent: String(formData.get('secondaryContent') || ''),
      ...(page === 'about' && {
        editorialBoard,
      }),
    },
  })

  redirect(`/editorial/pages/${page}?mode=preview`)
}

export async function restoreSiteContentVersion(formData: FormData) {
  const rawContentID = String(formData.get('contentId') || '')
  const versionId = String(formData.get('versionId') || '')
  const page = String(formData.get('page') || '')

  const contentId = Number(rawContentID)

  if (!Number.isInteger(contentId) || !versionId) {
    throw new Error('Invalid version.')
  }

  if (!isSitePage(page)) {
    throw new Error('Invalid site content page.')
  }

  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login')
  }

  const version = await payload.findVersionByID({
    collection: 'site-content',
    id: versionId,
    depth: 1,
  })

  if (!version || Number(version.parent) !== contentId) {
    throw new Error('Version does not belong to this page.')
  }

  const source = version.version

  await payload.update({
    collection: 'site-content',
    id: contentId,
    data: {
      heroTitle: source.heroTitle,
      heroBody: source.heroBody,
      content: source.content,
      secondaryTitle: source.secondaryTitle,
      secondaryContent: source.secondaryContent,
      ...(page === 'about' && {
        editorialBoard: source.editorialBoard,
      }),
    },
  })

  redirect(`/editorial/pages/${page}?mode=preview`)
}
