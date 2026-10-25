'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'

import type { Submission } from '@/payload-types'
import { requireRole } from '@/lib/requireRole'
import { buildSubmissionUpdate } from '@/lib/submissionUpdate'
import { createRevisionToken } from '@/lib/revisionAccess'
import {
  notifyAuthorOfDecision,
  notifyAuthorOfPublication,
  notifyStaffOfPublication,
  sendRevisionRequest,
  siteURL,
} from '@/lib/notifications'
import { articlePath } from '@/lib/slugs'
import { isDecisionStatus, isUnpublishStatus, workflowStatusLabels } from '@/lib/workflow'
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

/*
 * Approves and publishes a paper. Publishing assigns its permanent URL
 * slug (Submissions beforeChange). Only a real transition to Published
 * notifies anyone: approving an already-published paper (a double-click
 * or a repeat) does nothing.
 */
export async function approveSubmission(formData: FormData) {
  const { payload, user } = await requireRole('editor')
  const id = String(formData.get('id') || '')

  if (!id) {
    throw new Error('Submission ID is required.')
  }

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 0,
  })

  if (submission.workflowStatus === 'published') {
    redirect(articlePath(submission))
  }

  const published = await payload.update({
    collection: 'submissions',
    id,
    data: {
      workflowStatus: 'published',
      publishedDate: submission.publishedDate || new Date().toISOString(),
    },
  })

  const articleURL = `${siteURL}${articlePath(published)}`

  // Saved; tell the author and the rest of the editorial team after the response.
  after(async () => {
    await notifyAuthorOfPublication(payload, published, articleURL)
    await notifyStaffOfPublication(payload, published, articleURL, user)
  })

  revalidatePath('/')
  revalidatePath('/articles')
  revalidatePath(articlePath(published))
  revalidatePath(`/editorial/submissions/${id}`)

  redirect(articlePath(published))
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

  // A double-click (same request moments apart) would otherwise email a
  // second link and silently invalidate the first.
  if (submission.workflowStatus === 'revision_requested') {
    const recent = await payload.find({
      collection: 'editor-notes',
      where: {
        and: [
          { submission: { equals: id } },
          { noteType: { equals: 'revision_request' } },
          { createdAt: { greater_than: new Date(Date.now() - 2 * 60 * 1000).toISOString() } },
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    })

    if (recent.docs[0]?.note === message) {
      redirect(`/editorial/submissions/${id}?mode=preview&revisions=sent`)
    }
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

  // Saved; email the author after the response so delivery can't affect it.
  after(() => sendRevisionRequest(payload, updated, `${siteURL}/revise/${token}`, message, expiresAt))

  revalidatePath('/')
  revalidatePath('/articles')
  revalidatePath(`/editorial/submissions/${id}`)

  redirect(`/editorial/submissions/${id}?mode=preview&revisions=sent`)
}

/*
 * Records the editors' decision (Accept or Reject) as a decision note,
 * moves the paper to that status and emails the author. Only a real
 * change emails anyone: repeating the current decision does nothing.
 * Published papers are unpublished first; a decision ends any open
 * revision link (Submissions beforeChange).
 */
export async function recordDecision(formData: FormData) {
  const { payload, user } = await requireRole('editor')

  const id = getSubmissionID(formData)
  const decision = formData.get('decision')
  const message = String(formData.get('message') || '').trim()

  if (!isDecisionStatus(decision)) {
    throw new Error('Choose Accept or Reject.')
  }

  if (decision === 'rejected' && !message) {
    throw new Error('Please include a message to the author explaining the decision.')
  }

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 0,
  })

  if (submission.trashed) {
    throw new Error('Restore this submission from the trash first.')
  }

  if (submission.workflowStatus === 'published') {
    throw new Error('Unpublish this paper before recording a decision.')
  }

  if (submission.workflowStatus === decision) {
    redirect(`/editorial/submissions/${id}?mode=preview`)
  }

  await payload.create({
    collection: 'editor-notes',
    data: {
      submission: id,
      createdBy: user.id,
      noteType: 'decision',
      note: `${workflowStatusLabels[decision]}${message ? `: ${message}` : ''}`,
    },
  })

  const updated = await payload.update({
    collection: 'submissions',
    id,
    data: {
      workflowStatus: decision,
    },
  })

  // Saved; email the author after the response so delivery can't affect it.
  after(() => notifyAuthorOfDecision(payload, updated, decision, message || undefined))

  revalidatePath(`/editorial/submissions/${id}`)

  redirect(`/editorial/submissions/${id}?mode=preview&decision=${decision}`)
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
  revalidatePath(articlePath(submission))
  revalidatePath(`/editorial/submissions/${id}`)

  redirect(`/editorial/submissions/${id}?mode=preview`)
}
