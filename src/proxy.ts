import { NextResponse, type NextRequest } from 'next/server'

import { getAuthConfig } from '@/lib/auth/config'
import { pathnameHeader } from '@/lib/auth/returnTo'
import {
  cognitoCookieOptions,
  expiresWithin,
  idTokenCookie,
  refreshIdToken,
  refreshTokenCookie,
  sessionMaxAge,
} from '@/lib/auth/cognito'

/*
 * Runs before every page and API request.
 *
 * 1. Passes the requested path to the app (server components cannot read
 *    it otherwise), so sign-in can return people to the protected page
 *    they asked for.
 * 2. Keeps Cognito sessions alive: server-rendered pages cannot set
 *    cookies, so the ID token is refreshed here, before the request
 *    reaches the app, and handed to both this request and the browser.
 */
export async function proxy(request: NextRequest) {
  // Never trust a client-supplied value for this header.
  request.headers.set(pathnameHeader, request.nextUrl.pathname + request.nextUrl.search)

  const next = () => NextResponse.next({ request: { headers: request.headers } })

  const cognito = getAuthConfig().cognito
  const refreshToken = request.cookies.get(refreshTokenCookie)?.value

  if (!cognito || !refreshToken) return next()

  const idToken = request.cookies.get(idTokenCookie)?.value

  if (idToken && !expiresWithin(idToken, 60)) return next()

  try {
    const tokens = await refreshIdToken(cognito, refreshToken)

    // Let this request see the fresh token too.
    request.cookies.set(idTokenCookie, tokens.id_token)

    const response = next()

    response.cookies.set(idTokenCookie, tokens.id_token, { ...cognitoCookieOptions, maxAge: sessionMaxAge })

    // Only present if the app client rotates refresh tokens.
    if (tokens.refresh_token) {
      response.cookies.set(refreshTokenCookie, tokens.refresh_token, {
        ...cognitoCookieOptions,
        maxAge: sessionMaxAge,
      })
    }

    return response
  } catch {
    // Revoked or expired refresh token (e.g. after sign-out everywhere): end the session.
    request.cookies.delete(idTokenCookie)
    request.cookies.delete(refreshTokenCookie)

    const response = next()

    response.cookies.delete(idTokenCookie)
    response.cookies.delete(refreshTokenCookie)

    return response
  }
}

export const config = {
  // Everything except Next's static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
