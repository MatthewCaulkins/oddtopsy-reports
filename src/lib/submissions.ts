import type { Payload } from 'payload'

import type { Submission } from '@/payload-types'
import { isValidEmail } from '@/lib/validation'

/*
 * Public manuscript submission.
 *
 * 1. Everything is validated (with Payload's own rules) before any file
 *    is uploaded, so a bad field cannot leave orphaned uploads behind.
 * 2. Each form carries a submission key. A retry or double-click whose
 *    first attempt already saved returns that submission instead of
 *    creating a duplicate.
 * 3. If saving fails after uploads, the uploads from this attempt are
 *    removed.
 *
 * Expected problems throw SubmissionError, whose message is safe to show.
 * Notifications are the caller's job, after this returns.
 */

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'SubmissionError'
  }
}

export type SubmissionResult = {
  submission: Submission
  duplicate: boolean
}

const submissionKeyPattern = /^[A-Za-z0-9-]{16,64}$/

function text(formData: FormData, name: string) {
  return String(formData.get(name) || '').trim()
}

function file(formData: FormData, name: string) {
  const value = formData.get(name)

  return value instanceof File && value.size > 0 ? value : null
}

function readForm(formData: FormData) {
  const title = text(formData, 'title')
  const abstract = text(formData, 'abstract')
  const correspondingAuthorName = text(formData, 'correspondingAuthorName')
  const correspondingAuthorEmail = text(formData, 'correspondingAuthorEmail').toLowerCase()
  const leadAuthorName = text(formData, 'leadAuthorName')
  const submissionType = text(formData, 'submissionType') === 'editor' ? 'editor' : 'upload'
  const manuscriptBody = text(formData, 'manuscriptBody')
  const findingDate = text(formData, 'findingDate')
  const submissionKey = text(formData, 'submissionKey')

  const focusAreas = formData
    .getAll('focusArea')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)

  const featuredImage = file(formData, 'featuredImage')
  const manuscriptPDF = file(formData, 'manuscriptPDF')

  const supportingImages = (formData.getAll('supportingImages') as File[]).filter(
    (item) => item instanceof File && item.size > 0,
  )

  if (!title) throw new SubmissionError('Please enter the paper title.', 'title')
  if (!featuredImage) throw new SubmissionError('Please upload a featured image.', 'featuredImage')
  if (!abstract) throw new SubmissionError('Please enter an abstract.', 'abstract')
  if (focusAreas.length === 0) throw new SubmissionError('Please choose at least one focus area.', 'focusArea')
  if (!correspondingAuthorName) {
    throw new SubmissionError('Please enter the corresponding author’s name.', 'correspondingAuthorName')
  }
  if (!isValidEmail(correspondingAuthorEmail)) {
    throw new SubmissionError(
      'Please enter a complete email address for the corresponding author, such as name@example.org.',
      'correspondingAuthorEmail',
    )
  }
  if (!leadAuthorName) throw new SubmissionError('Please enter the lead author’s name.', 'leadAuthorName')
  if (submissionType === 'upload' && !manuscriptPDF) {
    throw new SubmissionError('Please upload the manuscript PDF.', 'manuscriptPDF')
  }
  if (submissionType === 'editor' && !manuscriptBody) {
    throw new SubmissionError('Please enter the manuscript text.', 'manuscriptBody')
  }
  if (findingDate && Number.isNaN(Date.parse(findingDate))) {
    throw new SubmissionError('Please enter a valid date of finding.', 'findingDate')
  }

  const keywords = text(formData, 'keywords')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .map((keyword) => ({ keyword }))

  let coAuthors: { name: string; affiliation: string }[] = []

  try {
    coAuthors = (JSON.parse(text(formData, 'coAuthors') || '[]') as { name?: string; affiliation?: string }[])
      .map((author) => ({
        name: String(author?.name || '').trim(),
        affiliation: String(author?.affiliation || '').trim(),
      }))
      .filter((author) => author.name)
  } catch {
    coAuthors = []
  }

  return {
    submissionKey: submissionKeyPattern.test(submissionKey) ? submissionKey : null,
    files: { featuredImage, manuscriptPDF: submissionType === 'upload' ? manuscriptPDF : null, supportingImages },
    data: {
      title,
      subtitle: text(formData, 'subtitle'),
      abstract,
      focusArea: focusAreas,
      keywords,
      findingDate: findingDate || undefined,
      location: text(formData, 'location'),
      leadAuthor: { name: leadAuthorName, affiliation: text(formData, 'leadAuthorAffiliation') },
      correspondingAuthor: {
        name: correspondingAuthorName,
        email: correspondingAuthorEmail,
        affiliation: text(formData, 'correspondingAuthorAffiliation'),
      },
      coAuthors,
      submissionType,
      manuscriptBody: submissionType === 'editor' ? manuscriptBody : undefined,
      mediaNotes: text(formData, 'mediaNotes'),
      authorMessage: text(formData, 'authorMessage'),
    } as const,
  }
}

async function findBySubmissionKey(payload: Payload, submissionKey: string) {
  const existing = await payload.find({
    collection: 'submissions',
    where: { submissionKey: { equals: submissionKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return existing.docs[0] || null
}

function isUniqueViolation(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : ''

  return /duplicate key|unique constraint|submission_key/i.test(text)
}

export async function createPublicSubmission(payload: Payload, formData: FormData): Promise<SubmissionResult> {
  const input = readForm(formData)

  if (input.submissionKey) {
    const existing = await findBySubmissionKey(payload, input.submissionKey)

    if (existing) {
      payload.logger.info({ event: 'submission.duplicate', submissionID: existing.id }, 'Duplicate submission ignored')
      return { submission: existing, duplicate: true }
    }
  }

  const uploaded: number[] = []

  async function upload(item: File, alt: string) {
    const media = await payload.create({
      collection: 'media',
      data: { alt },
      file: {
        data: Buffer.from(await item.arrayBuffer()),
        mimetype: item.type,
        name: item.name,
        size: item.size,
      },
    })

    uploaded.push(Number(media.id))

    return Number(media.id)
  }

  try {
    const featuredImage = await upload(input.files.featuredImage!, `${input.data.title} featured image`)
    const manuscriptPDF = input.files.manuscriptPDF
      ? await upload(input.files.manuscriptPDF, `${input.data.title} manuscript PDF`)
      : undefined

    const supportingImages = []

    for (const [index, item] of input.files.supportingImages.entries()) {
      supportingImages.push({
        image: await upload(item, `${input.data.title} supporting image ${index + 1}`),
        caption: '',
      })
    }

    const submission = await payload.create({
      collection: 'submissions',
      data: {
        ...input.data,
        featuredImage,
        manuscriptPDF,
        supportingImages,
        workflowStatus: 'submitted',
        submissionKey: input.submissionKey,
      },
    })

    payload.logger.info({ event: 'submission.created', submissionID: submission.id, files: uploaded.length }, 'Submission saved')

    return { submission, duplicate: false }
  } catch (error) {
    await removeUploads(payload, uploaded)

    // A simultaneous duplicate (double-click) won the race; return that one.
    if (input.submissionKey && isUniqueViolation(error)) {
      const existing = await findBySubmissionKey(payload, input.submissionKey)

      if (existing) return { submission: existing, duplicate: true }
    }

    payload.logger.error(
      { event: 'submission.failed', err: error, removedUploads: uploaded.length },
      'Submission could not be saved',
    )

    if (error instanceof Error && error.name === 'ValidationError') {
      // Payload validation messages name the field and are safe to show.
      throw new SubmissionError(`${error.message}. Nothing was submitted; please correct it and try again.`)
    }

    throw new SubmissionError('Your submission could not be saved, and nothing was submitted. Please try again.')
  }
}

async function removeUploads(payload: Payload, ids: number[]) {
  for (const id of ids) {
    try {
      await payload.delete({ collection: 'media', id, overrideAccess: true })
    } catch (error) {
      payload.logger.error({ event: 'submission.cleanup_failed', mediaID: id, err: error }, 'Could not remove an orphaned upload')
    }
  }
}
