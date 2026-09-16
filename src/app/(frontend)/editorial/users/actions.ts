'use server'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import config from '@/payload.config'

type ManageableRole = 'pending' | 'editor' | 'manager'

async function requireUserManager() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'manager' && user.role !== 'admin') {
    redirect('/editorial')
  }

  return {
    payload,
    user,
  }
}

function getUserID(formData: FormData) {
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id)) {
    throw new Error('Invalid user ID.')
  }

  return id
}

export async function approveUser(formData: FormData) {
  const { payload } = await requireUserManager()

  const id = getUserID(formData)

  const target = await payload.findByID({
    collection: 'users',
    id,
  })

  if (target.role !== 'pending') {
    throw new Error('Only pending users can be approved.')
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
  const { payload } = await requireUserManager()

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
  const { payload, user } = await requireUserManager()

  const id = getUserID(formData)

  const requestedRole = String(formData.get('role') || '')

  const allowedRoles: ManageableRole[] = ['pending', 'editor', 'manager']

  if (!allowedRoles.includes(requestedRole as ManageableRole)) {
    throw new Error('Invalid user role.')
  }

  const target = await payload.findByID({
    collection: 'users',
    id,
  })

  /*
   * Managers cannot change an admin account.
   */
  if (target.role === 'admin' && user.role !== 'admin') {
    throw new Error('Only an administrator can modify an administrator account.')
  }

  /*
   * Prevent managers from changing themselves
   * accidentally.
   */
  if (Number(target.id) === Number(user.id) && user.role === 'manager') {
    throw new Error('Managers cannot change their own role.')
  }

  await payload.update({
    collection: 'users',
    id,
    data: {
      role: requestedRole as ManageableRole,
    },
  })

  revalidatePath('/editorial/users')
  //   redirect('/editorial/users')
}

export async function promoteToAdmin(formData: FormData) {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'admin') {
    throw new Error('Only an administrator can create another administrator.')
  }

  const id = getUserID(formData)

  await payload.update({
    collection: 'users',
    id,
    data: {
      role: 'admin',
    },
  })

  revalidatePath('/editorial/users')
  redirect('/editorial/users')
}
