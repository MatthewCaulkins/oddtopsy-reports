import { NextResponse } from 'next/server'

import { getAuthConfig } from '@/lib/auth/config'
import {
  idTokenCookie,
  logoutURL,
  refreshTokenCookie,
  revokeRefreshToken,
} from '@/lib/auth/cognito'
import { readCookie } from '@/lib/signedCookies'

/*
 * Ends a Cognito session: revokes the refresh token, clears our
 * cookies, and tells the browser where to go next (Cognito's logout
 * endpoint, which also ends the hosted sign-in session). Password
 * sessions are ended separately by Payload's /api/users/logout.
 * POST only, so it cannot be triggered by a link or prefetch.
 */
export async function POST(request: Request) {
  const cognito = getAuthConfig().cognito
  const refreshToken = readCookie(request.headers, refreshTokenCookie)

  const hadCognitoSession = Boolean(cognito && (refreshToken || readCookie(request.headers, idTokenCookie)))

  if (cognito && refreshToken) {
    await revokeRefreshToken(cognito, refreshToken)
  }

  const response = NextResponse.json({
    redirect: cognito && hadCognitoSession ? logoutURL(cognito) : '/',
  })

  response.cookies.delete(idTokenCookie)
  response.cookies.delete(refreshTokenCookie)

  return response
}
