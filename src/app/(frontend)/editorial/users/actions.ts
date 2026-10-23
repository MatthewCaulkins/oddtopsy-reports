'use server'

import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { after } from 'next/server'

import {
  canAssignRole,
  canSetAccountStatus,
  isAssignableRole,
  isRole,
  type AccountStatus,
  type Role,
} from '@/access/roles'
import {
  approveAccessRequest,
  provisionAccess,
  rejectAccessRequest,
  resendInvite,
  sendSignInInvite,
} from '@/lib/accessRequests'
import { notifyApplicantOfRejection } from '@/lib/notifications'
import { requireRole } from '@/lib/requireRole'

function getID(formData: FormData) {
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id)) {
    throw new Error('Invalid ID.')
  }

  return id
}

export type UserActionResult =
  | { ok: true; role?: Role; accountStatus?: AccountStatus; message?: string }
  | { ok: false; error: string }

function failure(error: unknown): UserActionResult {
  // Let Next's own control flow (e.g. requireRole's redirect to /login) through.
  unstable_rethrow(error)

  // Our own checks and the last-admin guard produce safe, explanatory messages.
  return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' }
}

/*
 * Access requests
 */

export async function approveRequest(formData: FormData) {
  const { payload, user } = await requireRole('manager')

  const role = formData.get('role')

  if (!isAssignableRole(role)) {
    throw new Error('Choose Editor or Manager.')
  }

  await approveAccessRequest(payload, user, getID(formData), role)

  revalidatePath('/editorial/users')
}

export async function rejectRequest(formData: FormData) {
  const { payload, user } = await requireRole('manager')

  const note = String(formData.get('rejectionNote') || '').trim()

  const request = await rejectAccessRequest(payload, user, getID(formData), note)

  // The decision is saved; let the applicant know (never with the internal note).
  after(() => notifyApplicantOfRejection(payload, request))

  revalidatePath('/editorial/users')
}

export async function retryProvisioning(formData: FormData) {
  const { payload } = await requireRole('manager')

  await provisionAccess(payload, getID(formData))

  revalidatePath('/editorial/users')
}

/*
 * Existing accounts, called from the Users page row controls. Managers
 * change editors only; admins change anyone but themselves, including
 * granting admin. The last active admin is protected by the Users
 * collection hooks, whose message comes back as the error.
 */

export async function changeUserRole(id: number, role: string): Promise<UserActionResult> {
  try {
    const { payload, user } = await requireRole('manager')

    if (!isRole(role)) return { ok: false, error: 'Invalid role.' }

    const target = await payload.findByID({ collection: 'users', id })

    if (target.accountStatus === 'disabled') {
      return { ok: false, error: 'Re-enable this account before changing its role.' }
    }

    if (!canAssignRole(user, target, role)) {
      return { ok: false, error: 'You cannot assign that role to this user.' }
    }

    const updated = await payload.update({ collection: 'users', id, data: { role } })

    revalidatePath('/editorial/users')

    return { ok: true, role: updated.role, accountStatus: updated.accountStatus }
  } catch (error) {
    return failure(error)
  }
}

export async function changeAccountStatus(id: number, status: string): Promise<UserActionResult> {
  try {
    const { payload, user } = await requireRole('manager')

    const target = await payload.findByID({ collection: 'users', id })

    if (!canSetAccountStatus(user, target, status)) {
      return { ok: false, error: 'You cannot change this account.' }
    }

    // canSetAccountStatus narrows to the settable statuses.
    const updated = await payload.update({
      collection: 'users',
      id,
      data: { accountStatus: status as 'active' | 'disabled' },
    })

    revalidatePath('/editorial/users')

    return { ok: true, role: updated.role, accountStatus: updated.accountStatus }
  } catch (error) {
    return failure(error)
  }
}

export async function resendUserInvite(id: number): Promise<UserActionResult> {
  try {
    const { payload, user } = await requireRole('manager')

    await resendInvite(payload, user, id)

    revalidatePath('/editorial/users')

    return { ok: true, message: 'Invite sent.' }
  } catch (error) {
    return failure(error)
  }
}

export async function sendUserSignInInvite(id: number): Promise<UserActionResult> {
  try {
    const { payload, user } = await requireRole('manager')

    await sendSignInInvite(payload, user, id)

    revalidatePath('/editorial/users')

    return { ok: true, message: 'Cognito sign-in invite sent.' }
  } catch (error) {
    return failure(error)
  }
}
