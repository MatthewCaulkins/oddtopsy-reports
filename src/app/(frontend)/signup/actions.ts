'use server'

import { getPayload } from 'payload'
import config from '@/payload.config'

export type SignupState = {
  success?: boolean
  error?: string
}

export async function signup(
  _previousState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get('email') || '')
    .trim()
    .toLowerCase()

  const password = String(formData.get('password') || '')

  const confirmPassword = String(formData.get('confirmPassword') || '')

  const displayName = String(formData.get('displayName') || '').trim()

  if (!email) {
    return {
      error: 'Email is required.',
    }
  }

  if (!displayName) {
    return {
      error: 'Name is required.',
    }
  }

  if (password.length < 8) {
    return {
      error: 'Password must be at least 8 characters.',
    }
  }

  if (password !== confirmPassword) {
    return {
      error: 'Passwords do not match.',
    }
  }

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: {
      email: {
        equals: email,
      },
    },
    limit: 1,
  })

  /*
   * Don't create duplicate accounts.
   */
  if (existing.docs.length > 0) {
    return {
      error: 'An account already exists for this email address.',
    }
  }

  await payload.create({
    collection: 'users',

    data: {
      email,
      password,

      // Never accept this from form input.
      role: 'pending',

      profile: {
        displayName,
      },
    },
  })

  return {
    success: true,
  }
}
