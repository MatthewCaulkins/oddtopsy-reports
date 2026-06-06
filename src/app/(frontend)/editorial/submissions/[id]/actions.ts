'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function approveSubmission(formData: FormData) {
  const payload = await getPayload({ config })
  const id = String(formData.get('id') || '')

  if (!id) {
    throw new Error('Missing submission ID.')
  }

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
  })

  const slug = submission.slug || slugify(submission.title)

  await payload.update({
    collection: 'submissions',
    id,
    data: {
      status: 'published',
      slug,
      publishedDate: new Date().toISOString(),
    },
  })

  revalidatePath('/')
  revalidatePath('/articles')
  revalidatePath(`/articles/${slug}`)

  redirect(`/articles/${slug}`)
}
