'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { canAssignRole, isAssignableRole } from '@/access/roles'
import { requireRole } from '@/lib/requireRole'

function getUserID(formData: FormData) {
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id)) {
    throw new Error('Invalid user ID.')
  }

  return id
}

export async function approveUser(formData: FormData) {
  const { payload, user } = await requireRole('manager')

  const id = getUserID(formData)

  const target = await payload.findByID({
    collection: 'users',
    id,
  })

  if (target.role !== 'pending') {
    throw new Error('Only pending users can be approved.')
  }

  if (!canAssignRole(user, target, 'editor')) {
    throw new Error('You cannot approve this account.')
  }

  await payload.update({
    collection: 'users',
    id,
    data: {
      role: 'editor',
    },
  })

  revalidatePath('/editorial/users')
  redirect('/editorial/users')
}

export async function rejectUser(formData: FormData) {
  const { payload } = await requireRole('manager')

  const id = getUserID(formData)

  const target = await payload.findByID({
    collection: 'users',
    id,
  })

  if (target.role !== 'pending') {
    throw new Error('Only pending account requests can be rejected.')
  }

  await payload.delete({
    collection: 'users',
    id,
  })

  revalidatePath('/editorial/users')
  redirect('/editorial/users')
}

export async function updateUserRole(formData: FormData) {
  const { payload, user } = await requireRole('manager')

  const id = getUserID(formData)

  const requestedRole = formData.get('role')

  if (!isAssignableRole(requestedRole)) {
    throw new Error('Invalid user role.')
  }

  const target = await payload.findByID({
    collection: 'users',
    id,
  })

  /*
   * Managers can change pending users and editors only; the
   * admin can change anyone but themselves. No one can grant admin.
   */
  if (!canAssignRole(user, target, requestedRole)) {
    throw new Error('You cannot assign that role to this user.')
  }

  await payload.update({
    collection: 'users',
    id,
    data: {
      role: requestedRole,
    },
  })

  revalidatePath('/editorial/users')
}
