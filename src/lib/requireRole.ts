import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { hasRole, type Role } from '@/access/roles'
import { currentPath, signInURL } from '@/lib/auth/returnTo'

/*
 * Server-side guard for server actions and pages.
 * Server actions are public endpoints, so every one that
 * changes data must call this before touching Payload.
 */
export async function requireRole(minimum: Role) {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers })

  if (!user) {
    // Come back here after signing in.
    redirect(signInURL(currentPath(headers)))
  }

  if (!hasRole(user, minimum)) {
    redirect('/articles')
  }

  return {
    payload,
    user,
  }
}
