'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { headers as getHeaders } from 'next/headers'

import type { Submission } from '@/payload-types'
import {
  getVersionChanges,
  trackedVersionFields,
} from '@/app/(frontend)/components/version-history/versionUtils'

type RestorableSubmissionData = Partial<
  Pick<
    Submission,
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
  >
>

function getRelationshipID(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof value.id === 'number' || typeof value.id === 'string')
  ) {
    return value.id
  }

  return null
}

function normalizeRestoreValue(field: keyof RestorableSubmissionData, value: unknown): unknown {
  switch (field) {
    case 'featuredImage':
    case 'manuscriptPDF':
      return getRelationshipID(value)

    case 'focusArea':
      return Array.isArray(value)
        ? value.map(getRelationshipID).filter((id): id is string | number => id !== null)
        : []

    case 'supportingImages':
      return Array.isArray(value)
        ? value
            .map((item) => {
              if (!item || typeof item !== 'object') {
                return null
              }

              const image = 'image' in item ? getRelationshipID(item.image) : null

              if (image === null) return null

              return {
                image,
                caption: 'caption' in item ? String(item.caption ?? '') : '',
              }
            })
            .filter(
              (
                item,
              ): item is {
                image: string | number
                caption: string
              } => item !== null,
            )
        : []

    case 'keywords':
      return Array.isArray(value)
        ? value.map((item) => ({
            keyword:
              item && typeof item === 'object' && 'keyword' in item
                ? String(item.keyword ?? '')
                : '',
          }))
        : []

    case 'coAuthors':
      return Array.isArray(value)
        ? value.map((author) => ({
            name:
              author && typeof author === 'object' && 'name' in author
                ? String(author.name ?? '')
                : '',
            affiliation:
              author && typeof author === 'object' && 'affiliation' in author
                ? String(author.affiliation ?? '')
                : '',
          }))
        : []

    default:
      return value ?? null
  }
}

export async function restoreSubmissionVersion(formData: FormData) {
  const submissionId = String(formData.get('submissionId') || '')

  const versionId = String(formData.get('versionId') || '')

  if (!submissionId || !versionId) {
    throw new Error('Submission ID and version ID are required.')
  }

  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login')
  }

  const [currentSubmission, selectedVersion] = await Promise.all([
    payload.findByID({
      collection: 'submissions',
      id: submissionId,
      depth: 0,
      user,
      overrideAccess: false,
    }),

    payload.findVersionByID({
      collection: 'submissions',
      id: versionId,
      depth: 0,
      user,
      overrideAccess: false,
    }),
  ])

  if (String(selectedVersion.parent) !== submissionId) {
    throw new Error('The selected version does not belong to this submission.')
  }

  const historicalSubmission = selectedVersion.version

  if (!historicalSubmission) {
    throw new Error('The selected version has no restorable data.')
  }

  const changes = getVersionChanges(currentSubmission, historicalSubmission)

  if (changes.length === 0) {
    redirect(`/editorial/submissions/${submissionId}/history`)
  }

  const restoreData: Record<string, unknown> = {}

  for (const change of changes) {
    if (!trackedVersionFields.includes(change.field)) {
      continue
    }

    restoreData[change.field] = normalizeRestoreValue(
      change.field,
      historicalSubmission[change.field],
    )
  }

  await payload.update({
    collection: 'submissions',
    id: submissionId,
    data: restoreData,
    user,
    overrideAccess: false,
  })

  revalidatePath(`/editorial/submissions/${submissionId}`)

  revalidatePath(`/editorial/submissions/${submissionId}/history`)

  revalidatePath('/')
  revalidatePath('/articles')

  redirect(`/editorial/submissions/${submissionId}/history?restored=1`)
}

export async function approveSubmission(formData: FormData) {
  const payload = await getPayload({ config })
  const id = String(formData.get('id') || '')

  if (!id) {
    throw new Error('Submission ID is required.')
  }

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 0,
  })

  await payload.update({
    collection: 'submissions',
    id,
    data: {
      workflowStatus: 'published',
      publishedDate: submission.publishedDate || new Date().toISOString(),
    },
  })

  revalidatePath('/')
  revalidatePath('/articles')
  //   revalidatePath(`/articles/${submission.slug || id}`)
  revalidatePath(`/editorial/submissions/${id}`)

  redirect(`/articles/${submission.slug || id}`)
}

type SubmissionUpdateData = {
  title: string
  subtitle: string
  abstract: string
  focusArea: number[]
  keywords: { keyword: string }[]
  findingDate: string | null
  location: string

  leadAuthor: {
    name: string
    affiliation: string
  }

  correspondingAuthor: {
    name: string
    email: string
    affiliation: string
  }

  coAuthors: {
    id?: string
    name: string
    affiliation: string
  }[]

  submissionType: 'upload' | 'editor'
  mediaNotes: string
  authorMessage: string

  featuredImage?: number
  manuscriptBody?: string | null
  manuscriptPDF?: number | null

  supportingImages?: {
    image: number
    caption?: string | null
  }[]
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

function parseJSON<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function parseNumericIDs(values: FormDataEntryValue[]): number[] {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
}

function parseOptionalDate(value: FormDataEntryValue | null): string | null {
  const date = String(value || '').trim()

  if (!date) return null

  return new Date(`${date}T00:00:00`).toISOString()
}

export async function updateSubmission(formData: FormData) {
  const payload = await getPayload({ config })
  const id = String(formData.get('id') || '')

  if (!id) {
    throw new Error('Submission ID is required.')
  }

  const title = String(formData.get('title') || '').trim()
  const keywordsRaw = String(formData.get('keywords') || '').trim()

  const keywords = keywordsRaw
    ? keywordsRaw
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => ({ keyword }))
    : []

  const coAuthors = parseJSON<
    {
      id?: string | null
      name: string
      affiliation: string
    }[]
  >(formData.get('coAuthors'), [])
    .map((author) => ({
      ...(author.id ? { id: author.id } : {}),
      name: String(author.name || '').trim(),
      affiliation: String(author.affiliation || '').trim(),
    }))
    .filter((author) => author.name)

  const findingDate = String(formData.get('findingDate') || '').trim()

  const submissionType = formData.get('submissionType') === 'editor' ? 'editor' : 'upload'

  const data: SubmissionUpdateData = {
    title,
    subtitle: String(formData.get('subtitle') || '').trim(),

    abstract: String(formData.get('abstract') || '').trim(),

    focusArea: parseNumericIDs(formData.getAll('focusArea')),

    keywords,

    findingDate: findingDate ? new Date(`${findingDate}T00:00:00`).toISOString() : null,

    location: String(formData.get('location') || '').trim(),

    leadAuthor: {
      name: String(formData.get('leadAuthorName') || '').trim(),

      affiliation: String(formData.get('leadAuthorAffiliation') || '').trim(),
    },

    correspondingAuthor: {
      name: String(formData.get('correspondingAuthorName') || '').trim(),

      email: String(formData.get('correspondingAuthorEmail') || '').trim(),

      affiliation: String(formData.get('correspondingAuthorAffiliation') || '').trim(),
    },

    coAuthors,
    submissionType,

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

  if (submissionType === 'editor') {
    data.manuscriptBody = String(formData.get('manuscriptBody') || '').trim()

    data.manuscriptPDF = null
  }

  if (submissionType === 'upload') {
    data.manuscriptBody = null
  }

  const retainedSupportingImageIDs = parseJSON<Array<number | string>>(
    formData.get('retainedSupportingImageIDs'),
    [],
  )
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)

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

    const retainedSupportingImages =
      existingSubmission.supportingImages
        ?.map((item) => {
          const imageID =
            typeof item.image === 'object' ? Number(item.image?.id) : Number(item.image)

          if (!imageID || !retainedSupportingImageIDs.includes(imageID)) {
            return null
          }

          return {
            image: imageID,
            caption: item.caption || '',
          }
        })
        .filter(
          (
            item,
          ): item is {
            image: number
            caption: string
          } => item !== null,
        ) || []

    data.supportingImages = [...retainedSupportingImages, ...newSupportingImages]
  }

  await payload.update({
    collection: 'submissions',
    id,
    data,
  })

  revalidatePath(`/editorial/submissions/${id}`)
  revalidatePath(`/editorial/submissions/${id}/history`)
  revalidatePath('/')
  revalidatePath('/articles')

  redirect(`/editorial/submissions/${id}?mode=preview`)
}
