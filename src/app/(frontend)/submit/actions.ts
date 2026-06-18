'use server'

import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Submission } from '@/payload-types'

function htmlToLexicalText(html: string): Submission['manuscriptBody'] {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: null,
          textStyle: '',
          textFormat: 0,
          children: [
            {
              type: 'text',
              text: html,
              format: 0,
              style: '',
              mode: 'normal',
              detail: 0,
              version: 1,
            },
          ],
        },
      ],
    },
  }
}

export async function submitPaper(formData: FormData) {
  const payload = await getPayload({ config })

  const title = String(formData.get('title') || '').trim()
  const subtitle = String(formData.get('subtitle') || '').trim()
  //   const featuredImage = formData.get('featuredImage') as File | null
  //   const focusAreaRaw = String(formData.get('focusArea') || '').trim()
  //   const focusArea = focusAreaRaw ? Number(focusAreaRaw) : undefined

  const focusAreas = formData
    .getAll('focusArea')
    .map((value) => Number(value))
    .filter(Boolean)

  const findingDate = String(formData.get('findingDate') || '').trim()
  const location = String(formData.get('location') || '').trim()
  const mediaNotes = String(formData.get('mediaNotes') || '').trim()
  const abstract = String(formData.get('abstract') || '').trim()
  const leadAuthorName = String(formData.get('leadAuthorName') || '').trim()
  const leadAuthorAffiliation = String(formData.get('leadAuthorAffiliation') || '').trim()

  const correspondingAuthorName = String(formData.get('correspondingAuthorName') || '').trim()
  const correspondingAuthorEmail = String(formData.get('correspondingAuthorEmail') || '').trim()
  const correspondingAuthorAffiliation = String(
    formData.get('correspondingAuthorAffiliation') || '',
  ).trim()

  const authorMessage = String(formData.get('authorMessage') || '').trim()
  const submissionType = String(formData.get('submissionType') || 'upload') as 'upload' | 'editor'
  const manuscripBody = String(formData.get('manuscripBody') || '').trim()
  const pdf = formData.get('manuscriptPDF') as File | null

  const supportingImages = formData.getAll('supportingImages') as File[]
  const keywordsRaw = String(formData.get('keywords') || '').trim()

  const keywords = keywordsRaw
    ? keywordsRaw
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => ({ keyword }))
    : []

  if (!title || !leadAuthorName || !correspondingAuthorName || !correspondingAuthorEmail) {
    throw new Error('Missing required fields.')
  }

  const featuredImage = formData.get('featuredImage') as File | null

  if (!featuredImage || featuredImage.size === 0) {
    throw new Error('Please upload a featured image.')
  }

  let mediaID: number | undefined

  if (submissionType === 'upload') {
    if (!pdf || pdf.size === 0) {
      throw new Error('Please upload a manuscript PDF.')
    }

    mediaID = await uploadMedia(pdf, title)
  }

  if (submissionType === 'editor' && !manuscripBody) {
    throw new Error('Please enter the manuscript text.')
  }

  let coAuthors = []

  try {
    coAuthors = JSON.parse(String(formData.get('coAuthors') || '[]'))
      .filter((author: any) => author.name?.trim())
      .map((author: any) => ({
        name: String(author.name || '').trim(),
        affiliation: String(author.affiliation || '').trim(),
      }))
  } catch {
    coAuthors = []
  }

  async function uploadMedia(file: File, alt: string) {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const media = await payload.create({
      collection: 'media',
      data: {
        alt,
      },
      file: {
        data: buffer,
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
    })

    return Number(media.id)
  }

  // Images
  const featuredImageID = await uploadMedia(featuredImage, `${title} featured image`)

  const supportingImageData = await Promise.all(
    supportingImages
      .filter((file) => file.size > 0)
      .map(async (file, index) => ({
        image: await uploadMedia(file, `${title} supporting image ${index + 1}`),
        caption: '',
      })),
  )

  await payload.create({
    collection: 'submissions',
    data: {
      title,
      subtitle,
      featuredImage: featuredImageID,
      abstract,
      focusArea: focusAreas,
      keywords,
      findingDate: findingDate || undefined,
      location,
      leadAuthor: {
        name: leadAuthorName,
        affiliation: leadAuthorAffiliation,
      },
      correspondingAuthor: {
        name: correspondingAuthorName,
        email: correspondingAuthorEmail,
        affiliation: correspondingAuthorAffiliation,
      },
      coAuthors,
      submissionType,
      manuscriptPDF: mediaID,
      manuscriptBody: submissionType === 'editor' ? htmlToLexicalText(manuscripBody) : undefined,
      supportingImages: supportingImageData,
      mediaNotes,
      authorMessage,
      status: 'submitted',
    },
  })

  redirect('/submit/thank-you')
}
