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

  await payload.update({
    collection: 'site-content',
    id,
    data: {
      heroTitle: String(formData.get('heroTitle') || '').trim(),
      heroBody: String(formData.get('heroBody') || ''),
      content: String(formData.get('content') || ''),
      secondaryTitle: String(formData.get('secondaryTitle') || '').trim(),
      secondaryContent: String(formData.get('secondaryContent') || ''),
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
    },
  })

  redirect(`/editorial/pages/${page}?mode=preview`)
}
