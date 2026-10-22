'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { Submission } from '@/payload-types'
import { requireRole } from '@/lib/requireRole'
import { buildSubmissionUpdate } from '@/lib/submissionUpdate'
import { createRevisionToken } from '@/lib/revisionAccess'
import { sendRevisionRequest, siteURL } from '@/lib/notifications'
import { isUnpublishStatus } from '@/lib/workflow'
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

  const { payload, user } = await requireRole('editor')

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
  const { payload } = await requireRole('editor')
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

export async function updateSubmission(formData: FormData) {
  const { payload } = await requireRole('editor')
  const id = String(formData.get('id') || '')

  if (!id) {
    throw new Error('Submission ID is required.')
  }

  const data = await buildSubmissionUpdate(payload, id, formData)

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

function getSubmissionID(formData: FormData) {
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id)) {
    throw new Error('Invalid submission ID.')
  }

  return id
}

/*
 * Asks the corresponding author for revisions: records the request
 * as an editor note, moves the paper to Revision Requested (taking
 * it offline if it was published), and emails the author a private
 * link to revise it. Requesting again sends a fresh link.
 */
export async function requestRevisions(formData: FormData) {
  const { payload, user } = await requireRole('editor')

  const id = getSubmissionID(formData)
  const message = String(formData.get('message') || '').trim()

  if (!message) {
    throw new Error('Please describe the revisions needed.')
  }

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 0,
  })

  if (submission.trashed) {
    throw new Error('Restore this submission from the trash first.')
  }

  const { token, tokenHash, expiresAt } = createRevisionToken()

  await payload.create({
    collection: 'editor-notes',
    data: {
      submission: id,
      createdBy: user.id,
      noteType: 'revision_request',
      note: message,
    },
  })

  const updated = await payload.update({
    collection: 'submissions',
    id,
    data: {
      workflowStatus: 'revision_requested',
      revisionAccess: {
        tokenHash,
        expiresAt: expiresAt.toISOString(),
      },
    },
  })

  await sendRevisionRequest(payload, updated, `${siteURL}/revise/${token}`, message, expiresAt)

  revalidatePath('/')
  revalidatePath('/articles')
  revalidatePath(`/editorial/submissions/${id}`)

  redirect(`/editorial/submissions/${id}?mode=preview&revisions=sent`)
}

/*
 * Takes a published paper offline. Its files return to staff-only
 * automatically. Use Request Revisions instead to send it back to
 * the author.
 */
export async function unpublishSubmission(formData: FormData) {
  const { payload } = await requireRole('editor')

  const id = getSubmissionID(formData)
  const status = formData.get('status')

  if (!isUnpublishStatus(status)) {
    throw new Error('Choose a status for the unpublished paper.')
  }

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 0,
  })

  if (submission.workflowStatus !== 'published') {
    throw new Error('This paper is not published.')
  }

  await payload.update({
    collection: 'submissions',
    id,
    data: {
      workflowStatus: status,
    },
  })

  revalidatePath('/')
  revalidatePath('/articles')
  revalidatePath(`/articles/${submission.slug || id}`)
  revalidatePath(`/editorial/submissions/${id}`)

  redirect(`/editorial/submissions/${id}?mode=preview`)
}
