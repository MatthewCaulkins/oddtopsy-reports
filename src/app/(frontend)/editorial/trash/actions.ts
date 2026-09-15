'use server'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import config from '@/payload.config'

async function requireEditor() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'editor' && user.role !== 'manager' && user.role !== 'admin') {
    redirect('/articles')
  }

  return {
    payload,
    user,
  }
}

async function requireManager() {
  const result = await requireEditor()

  if (result.user.role !== 'manager' && result.user.role !== 'admin') {
    throw new Error('Manager access is required.')
  }

  return result
}

function getSubmissionID(formData: FormData) {
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id)) {
    throw new Error('Invalid submission ID.')
  }

  return id
}

export async function moveSubmissionToTrash(formData: FormData) {
  const { payload, user } = await requireEditor()

  const id = getSubmissionID(formData)

  await payload.update({
    collection: 'submissions',
    id,
    data: {
      trashed: true,
      trashedAt: new Date().toISOString(),
      trashedBy: user.id,
    },
  })

  revalidatePath('/articles')
  revalidatePath('/editorial/trash')

  redirect('/editorial/trash')
}

export async function restoreSubmission(formData: FormData) {
  const { payload } = await requireEditor()

  const id = getSubmissionID(formData)

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
  })

  if (!submission.trashed) {
    throw new Error('This submission is not in the trash.')
  }

  await payload.update({
    collection: 'submissions',
    id,
    data: {
      trashed: false,
      trashedAt: null,
      trashedBy: null,
    },
  })

  revalidatePath('/articles')
  revalidatePath('/editorial/trash')
}

export async function deleteSubmissionPermanently(formData: FormData) {
  const { payload } = await requireManager()

  const id = getSubmissionID(formData)

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
  })

  if (!submission.trashed) {
    throw new Error('Only trashed submissions can be permanently deleted.')
  }

  await payload.delete({
    collection: 'submissions',
    id,
  })

  revalidatePath('/articles')
  revalidatePath('/editorial/trash')
}

export async function emptyTrash() {
  const { payload } = await requireManager()

  const trashed = await payload.find({
    collection: 'submissions',
    where: {
      trashed: {
        equals: true,
      },
    },
    pagination: false,
    depth: 0,
  })

  for (const submission of trashed.docs) {
    await payload.delete({
      collection: 'submissions',
      id: submission.id,
    })
  }

  revalidatePath('/articles')
  revalidatePath('/editorial/trash')
}
