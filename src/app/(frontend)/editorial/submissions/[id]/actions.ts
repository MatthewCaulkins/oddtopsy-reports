'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

export async function approveSubmission(formData: FormData) {
  const payload = await getPayload({ config })
  const id = String(formData.get('id') || '')

  await payload.update({
    collection: 'submissions',
    id,
    data: {
      workflowStatus: 'published',
      publishedDate: new Date().toISOString(),
    },
  })

  revalidatePath('/')
  revalidatePath('/articles')
  redirect(`/articles/${id}`)
}

type SubmissionUpdateData = {
  title: string
  subtitle: string
  abstract: string
  keywords: { keyword: string }[]
  leadAuthor: {
    name: string
    affiliation: string
  }
  correspondingAuthor: {
    name: string
    email: string
    affiliation: string
  }
  mediaNotes: string
  authorMessage: string
  featuredImage?: number
  manuscriptPDF?: number
  supportingImages?: { image: number; caption?: string | null }[]
}

async function uploadMedia(payload: any, file: File, alt: string) {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const media = await payload.create({
    collection: 'media',
    data: { alt },
    file: {
      data: buffer,
      mimetype: file.type,
      name: file.name,
      size: file.size,
    },
  })

  return Number(media.id)
}

export async function updateSubmission(formData: FormData) {
  const payload = await getPayload({ config })
  const id = String(formData.get('id') || '')

  const title = String(formData.get('title') || '').trim()
  const keywordsRaw = String(formData.get('keywords') || '').trim()

  const keywords = keywordsRaw
    ? keywordsRaw
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => ({ keyword }))
    : []

  const data: SubmissionUpdateData = {
    title,
    subtitle: String(formData.get('subtitle') || '').trim(),
    abstract: String(formData.get('abstract') || '').trim(),
    keywords,
    leadAuthor: {
      name: String(formData.get('leadAuthorName') || '').trim(),
      affiliation: String(formData.get('leadAuthorAffiliation') || '').trim(),
    },
    correspondingAuthor: {
      name: String(formData.get('correspondingAuthorName') || '').trim(),
      email: String(formData.get('correspondingAuthorEmail') || '').trim(),
      affiliation: String(formData.get('correspondingAuthorAffiliation') || '').trim(),
    },
    mediaNotes: String(formData.get('mediaNotes') || '').trim(),
    authorMessage: String(formData.get('authorMessage') || '').trim(),
  }

  const featuredImage = formData.get('featuredImage') as File | null

  if (featuredImage && featuredImage.size > 0) {
    data.featuredImage = await uploadMedia(payload, featuredImage, `${title} featured image`)
  }

  const manuscriptPDF = formData.get('manuscriptPDF') as File | null

  if (manuscriptPDF && manuscriptPDF.size > 0) {
    data.manuscriptPDF = await uploadMedia(payload, manuscriptPDF, `${title} manuscript PDF`)
  }

  const supportingImages = formData.getAll('supportingImages') as File[]

  const newSupportingImages = await Promise.all(
    supportingImages
      .filter((file) => file.size > 0)
      .map(async (file, index) => ({
        image: await uploadMedia(payload, file, `${title} supporting image ${index + 1}`),
        caption: '',
      })),
  )

  if (newSupportingImages.length > 0) {
    const existingSubmission = await payload.findByID({
      collection: 'submissions',
      id,
      depth: 0,
    })

    if (newSupportingImages.length > 0) {
      const existingSubmission = await payload.findByID({
        collection: 'submissions',
        id,
        depth: 0,
      })

      const existingSupportingImages =
        existingSubmission.supportingImages
          ?.map((item) => {
            if (!item?.image) return null

            const imageID = typeof item.image === 'object' ? item.image.id : item.image

            if (!imageID) return null

            return {
              image: imageID,
              caption: item.caption || '',
            }
          })
          .filter((item): item is { image: number; caption: string } => item !== null) || []

      data.supportingImages = [...existingSupportingImages, ...newSupportingImages]
    }
  }

  await payload.update({
    collection: 'submissions',
    id,
    data,
  })

  revalidatePath(`/editorial/submissions/${id}`)
  revalidatePath('/')
  revalidatePath('/articles')

  redirect(`/editorial/submissions/${id}?mode=preview`)
}
