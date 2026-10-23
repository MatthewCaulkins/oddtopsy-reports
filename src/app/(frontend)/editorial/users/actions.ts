'use server'

import { revalidatePath } from 'next/cache'

import { canAssignRole, canSetAccountStatus, isAssignableRole, isRole } from '@/access/roles'
import {
  approveAccessRequest,
  provisionAccess,
  rejectAccessRequest,
  resendInvite,
} from '@/lib/accessRequests'
import { requireRole } from '@/lib/requireRole'

function getID(formData: FormData) {
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id)) {
    throw new Error('Invalid ID.')
  }

  return id
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

  await rejectAccessRequest(payload, user, getID(formData), note)

  revalidatePath('/editorial/users')
}

export async function retryProvisioning(formData: FormData) {
  const { payload } = await requireRole('manager')

  await provisionAccess(payload, getID(formData))

  revalidatePath('/editorial/users')
}

/*
 * Existing accounts. Managers change editors only; admins change anyone
 * but themselves, including granting admin. The last active admin is
 * protected by the Users collection hooks.
 */

export async function updateUserRole(formData: FormData) {
  const { payload, user } = await requireRole('manager')

  const id = getID(formData)
  const role = formData.get('role')

  if (!isRole(role)) {
    throw new Error('Invalid user role.')
  }

  const target = await payload.findByID({ collection: 'users', id })

  if (!canAssignRole(user, target, role)) {
    throw new Error('You cannot assign that role to this user.')
  }

  await payload.update({
    collection: 'users',
    id,
    data: { role },
  })

  revalidatePath('/editorial/users')
}

export async function setAccountStatus(formData: FormData) {
  const { payload, user } = await requireRole('manager')

  const id = getID(formData)
  const status = formData.get('accountStatus')

  const target = await payload.findByID({ collection: 'users', id })

  if (!canSetAccountStatus(user, target, status)) {
    throw new Error('You cannot change this account.')
  }

  // canSetAccountStatus narrows to the settable statuses.
  await payload.update({
    collection: 'users',
    id,
    data: { accountStatus: status as 'active' | 'disabled' },
  })

  revalidatePath('/editorial/users')
}

export async function resendUserInvite(formData: FormData) {
  const { payload, user } = await requireRole('manager')

  await resendInvite(payload, user, getID(formData))

  revalidatePath('/editorial/users')
}
