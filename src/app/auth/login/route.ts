import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'

import { getAuthConfig } from '@/lib/auth/config'
import { authorizeURL, createPKCE, oauthStateCookie, safeNextPath } from '@/lib/auth/cognito'
import { createSignedValue, signedCookieOptions } from '@/lib/signedCookies'

type OAuthState = {
  state: string
  verifier: string
  next: string
}

const stateMaxAge = 10 * 60

/*
 * Starts Cognito sign-in: remembers state, the PKCE verifier and where
 * to return, then sends the browser to the hosted sign-in page.
 */
export async function GET(request: Request) {
  const cognito = getAuthConfig().cognito

  if (!cognito) {
    return new NextResponse(null, { status: 303, headers: { Location: '/login' } })
  }

  const next = safeNextPath(new URL(request.url).searchParams.get('next'))
  const state = randomBytes(16).toString('base64url')
  const { verifier, challenge } = createPKCE()

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: authorizeURL(cognito, state, challenge) },
  })

  response.cookies.set(
    oauthStateCookie,
    createSignedValue<OAuthState>({ state, verifier, next }, stateMaxAge),
    { ...signedCookieOptions, maxAge: stateMaxAge },
  )

  return response
}
