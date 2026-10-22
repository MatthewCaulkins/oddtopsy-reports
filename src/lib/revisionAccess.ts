import { createHash, randomBytes } from 'crypto'
import type { Payload } from 'payload'

import type { Submission } from '@/payload-types'
import { createSignedValue, readCookie, readSignedValue } from '@/lib/signedCookies'

/*
 * Authors have no account, so a revision request emails them a
 * secret link. Only a SHA-256 hash of the token is stored. The link
 * works while the paper is in Revision Requested and the token has
 * not expired; resubmitting or any staff status change ends it.
 *
 * Opening the link starts a short revision session (a signed cookie)
 * so the token does not stay in the address bar.
 */

export const revisionLinkMaxAgeDays = 60

export const revisionSessionCookie = 'oddtopsy-revision'

export const revisionSessionMaxAge = 12 * 60 * 60

type RevisionSession = {
  submissionId: number
  tokenHash: string
}

export function hashRevisionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createRevisionToken() {
  const token = randomBytes(32).toString('base64url')

  return {
    token,
    tokenHash: hashRevisionToken(token),
    expiresAt: new Date(Date.now() + revisionLinkMaxAgeDays * 24 * 60 * 60 * 1000),
  }
}

export const clearedRevisionAccess = {
  tokenHash: null,
  expiresAt: null,
}

export function isRevisionOpen(submission: Submission, tokenHash: string) {
  const access = submission.revisionAccess

  return (
    submission.workflowStatus === 'revision_requested' &&
    !submission.trashed &&
    Boolean(access?.tokenHash) &&
    access?.tokenHash === tokenHash &&
    Boolean(access?.expiresAt) &&
    new Date(access!.expiresAt!).getTime() > Date.now()
  )
}

export async function findSubmissionByRevisionToken(payload: Payload, token: string) {
  const tokenHash = hashRevisionToken(token)

  const result = await payload.find({
    collection: 'submissions',
    where: {
      'revisionAccess.tokenHash': {
        equals: tokenHash,
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const submission = result.docs[0]

  return submission && isRevisionOpen(submission, tokenHash) ? submission : null
}

export function createRevisionSessionValue(submission: Submission) {
  return createSignedValue<RevisionSession>(
    {
      submissionId: submission.id,
      tokenHash: submission.revisionAccess!.tokenHash!,
    },
    revisionSessionMaxAge,
  )
}

/*
 * The submission the current visitor may revise, or null.
 */
export async function getRevisionSubmission(payload: Payload, headers: Headers, depth = 2) {
  const session = readSignedValue<RevisionSession>(readCookie(headers, revisionSessionCookie))

  if (!session) return null

  try {
    const submission = await payload.findByID({
      collection: 'submissions',
      id: session.submissionId,
      depth,
      overrideAccess: true,
    })

    if (!isRevisionOpen(submission, session.tokenHash)) return null

    // Keep the token hash on the server; this document is rendered for the author.
    const { revisionAccess: _revisionAccess, ...visible } = submission

    return visible as Submission
  } catch {
    return null
  }
}
