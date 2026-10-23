import { randomBytes } from 'crypto'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
} from 'payload'

import { canGrantOnApproval, canManageUser, type AssignableRole } from '@/access/roles'
import type { AccessRequest, User } from '@/payload-types'
import { getAuthConfig } from '@/lib/auth/config'
import { getIdentityProvider } from '@/lib/identity'
import { notifyStaffOfAccessRequest } from '@/lib/notifications'

/*
 * The access request workflow:
 *
 * 1. A visitor submits the Request Access form -> a pending request.
 * 2. A manager or the admin approves it with a role. The decision and
 *    the new User (status 'invited') are written in one transaction.
 * 3. Provisioning gives that User a way to sign in (see identity.ts).
 *    It talks to outside systems, so each attempt is recorded on the
 *    request and can be retried; failures are never cleaned up
 *    automatically.
 */

export class AccessRequestError extends Error {}

function getID(value: unknown): number | null {
  const id = value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value
  const numericID = Number(id)

  return Number.isInteger(numericID) && numericID > 0 ? numericID : null
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

/*
 * Records a request from the public form. Returns nothing either way:
 * the visitor sees the same response whether or not the email already
 * has an account or an open request, so the form reveals nothing.
 */
export async function submitAccessRequest(
  payload: Payload,
  input: { name: string; email: string; affiliation: string },
) {
  const email = normalizeEmail(input.email)

  const [existingUser, openRequest] = await Promise.all([
    payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
    }),
    payload.find({
      collection: 'access-requests',
      where: { and: [{ email: { equals: email } }, { status: { equals: 'pending' } }] },
      limit: 1,
      depth: 0,
    }),
  ])

  if (existingUser.docs.length > 0 || openRequest.docs.length > 0) {
    payload.logger.info({ event: 'access_request.duplicate' }, 'Access request ignored: email already known')
    return
  }

  const request = await payload.create({
    collection: 'access-requests',
    data: {
      name: input.name,
      email,
      affiliation: input.affiliation,
      status: 'pending',
      source: 'form',
    },
  })

  // The request is committed; tell the reviewers. Never throws.
  await notifyStaffOfAccessRequest(payload, request)
}

/*
 * Approves a pending request and provisions the new account. Calling
 * it again for an approved request whose provisioning failed retries
 * provisioning only; the decision is never repeated.
 */
export async function approveAccessRequest(
  payload: Payload,
  reviewer: User,
  requestID: number,
  role: AssignableRole,
) {
  if (!canGrantOnApproval(reviewer, role)) {
    throw new AccessRequestError('You cannot grant that role.')
  }

  const request = await payload.findByID({
    collection: 'access-requests',
    id: requestID,
    depth: 0,
  })

  if (request.status === 'rejected') {
    throw new AccessRequestError('This request was rejected.')
  }

  if (request.status === 'pending') {
    const req = await createLocalReq({}, payload)
    const ownsTransaction = await initTransaction(req)

    try {
      // Never attach a request to an existing account automatically.
      const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: normalizeEmail(request.email) } },
        limit: 1,
        depth: 0,
        req,
      })

      if (existing.docs.length > 0) {
        throw new AccessRequestError(
          'An account with this email already exists. Resolve it on the Users list instead of approving this request.',
        )
      }

      const user = await payload.create({
        collection: 'users',
        data: {
          email: normalizeEmail(request.email),
          // Password sign-in only: a placeholder nobody knows; the person sets
          // their own from the invite. With Cognito-only sign-in, no password.
          ...(getAuthConfig().password ? { password: randomBytes(32).toString('base64url') } : {}),
          role,
          accountStatus: 'invited',
          profile: {
            displayName: request.name,
            affiliation: request.affiliation,
          },
        },
        req,
      })

      await payload.update({
        collection: 'access-requests',
        id: requestID,
        data: {
          status: 'approved',
          grantedRole: role,
          reviewer: reviewer.id,
          decisionDate: new Date().toISOString(),
          user: user.id,
          provisioning: { status: 'in_progress' },
        },
        req,
      })

      if (ownsTransaction) await commitTransaction(req)
    } catch (error) {
      if (ownsTransaction) await killTransaction(req)
      throw error
    }
  }

  return provisionAccess(payload, requestID)
}

/*
 * Sends the approved person their sign-in invite and records the
 * outcome. Safe to call repeatedly.
 */
export async function provisionAccess(payload: Payload, requestID: number) {
  const request = await payload.findByID({
    collection: 'access-requests',
    id: requestID,
    depth: 0,
  })

  const userID = getID(request.user)

  if (request.status !== 'approved' || !userID) {
    throw new AccessRequestError('Only approved requests with an account can be provisioned.')
  }

  const attempts = (request.provisioning?.attempts || 0) + 1
  const lastAttemptAt = new Date().toISOString()

  try {
    const user = await payload.findByID({ collection: 'users', id: userID, depth: 0 })

    await getIdentityProvider().invite(payload, user)

    return await recordProvisioning(payload, requestID, {
      status: 'complete',
      attempts,
      lastAttemptAt,
      lastError: null,
      inviteSentAt: lastAttemptAt,
    })
  } catch (error) {
    payload.logger.error({ err: error }, `Provisioning failed for access request ${requestID}`)

    return recordProvisioning(payload, requestID, {
      ...request.provisioning,
      status: 'failed',
      attempts,
      lastAttemptAt,
      lastError: error instanceof Error ? error.message : String(error),
    })
  }
}

function recordProvisioning(
  payload: Payload,
  requestID: number,
  provisioning: NonNullable<AccessRequest['provisioning']>,
) {
  return payload.update({
    collection: 'access-requests',
    id: requestID,
    data: { provisioning },
    depth: 0,
  })
}

export async function rejectAccessRequest(
  payload: Payload,
  reviewer: User,
  requestID: number,
  rejectionNote: string,
) {
  if (!canGrantOnApproval(reviewer, 'editor')) {
    throw new AccessRequestError('You cannot review access requests.')
  }

  const request = await payload.findByID({
    collection: 'access-requests',
    id: requestID,
    depth: 0,
  })

  if (request.status !== 'pending') {
    throw new AccessRequestError('Only pending requests can be rejected.')
  }

  return payload.update({
    collection: 'access-requests',
    id: requestID,
    data: {
      status: 'rejected',
      reviewer: reviewer.id,
      decisionDate: new Date().toISOString(),
      rejectionNote: rejectionNote || null,
    },
  })
}

/*
 * Re-sends the invite to someone who has not set up their account yet,
 * recording it on their access request when there is one.
 */
export async function resendInvite(payload: Payload, actor: User, userID: number) {
  const target = await payload.findByID({ collection: 'users', id: userID, depth: 0 })

  if (!canManageUser(actor, target)) {
    throw new AccessRequestError('You cannot manage this account.')
  }

  if (target.accountStatus !== 'invited') {
    throw new AccessRequestError('Only invited accounts can be sent a new invite.')
  }

  const request = await payload.find({
    collection: 'access-requests',
    where: { user: { equals: userID } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
  })

  if (request.docs[0]) {
    return provisionAccess(payload, request.docs[0].id)
  }

  await getIdentityProvider().invite(payload, target)
}

/*
 * Gives an existing account that predates Cognito its Cognito sign-in:
 * creates the Cognito user, stores the returned sub and lets Cognito
 * send the invitation. Admin-initiated, so this is a trusted link, never
 * an email match. The account keeps its role and status.
 */
export async function sendSignInInvite(payload: Payload, actor: User, userID: number) {
  if (!getAuthConfig().cognito) {
    throw new AccessRequestError('Cognito sign-in is not enabled.')
  }

  const target = await payload.findByID({ collection: 'users', id: userID, depth: 0, overrideAccess: true })

  if (!canManageUser(actor, target)) {
    throw new AccessRequestError('You cannot manage this account.')
  }

  if (target.cognitoSub) {
    throw new AccessRequestError('This account already has Cognito sign-in.')
  }

  if (target.accountStatus === 'disabled') {
    throw new AccessRequestError('Re-enable the account before sending a sign-in invite.')
  }

  await getIdentityProvider().invite(payload, target)

  payload.logger.info({ event: 'account.signin_invite', userID }, 'Cognito sign-in invite sent to an existing account')
}
