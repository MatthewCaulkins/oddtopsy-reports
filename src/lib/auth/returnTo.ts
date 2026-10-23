import { safeNextPath } from '@/lib/auth/cognito'
import { getAuthConfig } from '@/lib/auth/config'

/*
 * Where sign-in returns people. By default the home page (only staff
 * sign in, and they can go to Editorial from the menu); when someone
 * was sent to sign in from a protected page, back to that page.
 */

// Set by src/proxy.ts on every request, overwriting any client value.
export const pathnameHeader = 'x-oddtopsy-pathname'

export function currentPath(headers: Headers) {
  return safeNextPath(headers.get(pathnameHeader))
}

/*
 * The sign-in URL for the configured method, returning to `next`.
 */
export function signInURL(next?: string | null) {
  const target = safeNextPath(next)
  const query = target === '/' ? '' : `?next=${encodeURIComponent(target)}`

  return getAuthConfig().password ? `/login${query}` : `/auth/login?next=${encodeURIComponent(target)}`
}
