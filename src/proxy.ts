import { NextResponse, type NextRequest } from 'next/server'

import { getAuthConfig } from '@/lib/auth/config'
import {
  cognitoCookieOptions,
  expiresWithin,
  idTokenCookie,
  refreshIdToken,
  refreshTokenCookie,
  sessionMaxAge,
} from '@/lib/auth/cognito'

/*
 * Keeps Cognito sessions alive. Server-rendered pages cannot set
 * cookies, so the ID token is refreshed here, before the request
 * reaches the app, and handed to both this request and the browser.
 * Does nothing unless Cognito sign-in is enabled and the visitor has
 * a Cognito session.
 */
export async function proxy(request: NextRequest) {
  const cognito = getAuthConfig().cognito

  const refreshToken = request.cookies.get(refreshTokenCookie)?.value

  if (!cognito || !refreshToken) return NextResponse.next()

  const idToken = request.cookies.get(idTokenCookie)?.value

  if (idToken && !expiresWithin(idToken, 60)) return NextResponse.next()

  try {
    const tokens = await refreshIdToken(cognito, refreshToken)

    // Let this request see the fresh token too.
    request.cookies.set(idTokenCookie, tokens.id_token)

    const response = NextResponse.next({ request: { headers: request.headers } })

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

    const response = NextResponse.next({ request: { headers: request.headers } })

    response.cookies.delete(idTokenCookie)
    response.cookies.delete(refreshTokenCookie)

    return response
  }
}

export const config = {
  // Everything except Next's static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
