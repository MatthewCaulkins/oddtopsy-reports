'use server'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

export async function updateSiteContent(formData: FormData) {
  const id = Number(formData.get('id'))
  const page = String(formData.get('page') || '')

  if (!Number.isInteger(id)) {
    throw new Error('Invalid site content ID.')
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
