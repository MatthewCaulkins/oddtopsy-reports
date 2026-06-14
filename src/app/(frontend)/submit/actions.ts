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
  const abstract = String(formData.get('abstract') || '').trim()
  const authorName = String(formData.get('authorName') || '').trim()
  const authorEmail = String(formData.get('authorEmail') || '').trim()
  const affiliation = String(formData.get('affiliation') || '').trim()
  const authorMessage = String(formData.get('authorMessage') || '').trim()
  const submissionType = String(formData.get('submissionType') || 'upload') as 'upload' | 'editor'
  const manuscriptHTML = String(formData.get('manuscriptHTML') || '').trim()
  const pdf = formData.get('manuscriptPDF') as File | null

  if (!title || !authorName || !authorEmail) {
    throw new Error('Missing required fields.')
  }

  let mediaID: number | undefined

  if (submissionType === 'upload') {
    if (!pdf || pdf.size === 0) {
      throw new Error('Please upload a manuscript PDF.')
    }

    const bytes = await pdf.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const media = await payload.create({
      collection: 'media',
      data: {
        alt: title,
      },
      file: {
        data: buffer,
        mimetype: pdf.type,
        name: pdf.name,
        size: pdf.size,
      },
    })

    mediaID = Number(media.id)
  }

  if (submissionType === 'editor' && !manuscriptHTML) {
    throw new Error('Please enter the manuscript text.')
  }

  await payload.create({
    collection: 'submissions',
    data: {
      title,
      abstract,
      submissionType,
      manuscriptPDF: mediaID,
      manuscriptBody: submissionType === 'editor' ? htmlToLexicalText(manuscriptHTML) : undefined,
      leadAuthor: {
        name: authorName,
        affiliation,
      },
      correspondingAuthor: {
        name: authorName,
        email: authorEmail,
        affiliation,
      },
      authorMessage,
      status: 'submitted',
    },
  })

  redirect('/submit/thank-you')
}
