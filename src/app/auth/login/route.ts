import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'

import { getAuthConfig } from '@/lib/auth/config'
import { authorizeURL, createPKCE, oauthStateCookie, safeNextPath } from '@/lib/auth/cognito'
import { createSignedValue, signedCookieOptions } from '@/lib/signedCookies'

type OAuthState = {
  state: string
  verifier: string
  next: string
  stepUp?: boolean
}

const stateMaxAge = 10 * 60

/*
 * Starts Cognito sign-in: remembers state, the PKCE verifier and where
 * to return, then sends the browser to the hosted sign-in page.
 *
 * ?reauth=1 is the step-up sign-in used before changing MFA settings
 * (see authorizeURL); the callback then keeps a short-lived access token.
 */
export async function GET(request: Request) {
  const cognito = getAuthConfig().cognito

  if (!cognito) {
    return new NextResponse(null, { status: 303, headers: { Location: '/login' } })
  }

  const params = new URL(request.url).searchParams
  const next = safeNextPath(params.get('next'))
  const stepUp = params.get('reauth') === '1'
  const state = randomBytes(16).toString('base64url')
  const { verifier, challenge } = createPKCE()

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: authorizeURL(cognito, state, challenge, { stepUp }) },
  })

  response.cookies.set(
    oauthStateCookie,
    createSignedValue<OAuthState>({ state, verifier, next, ...(stepUp ? { stepUp } : {}) }, stateMaxAge),
    { ...signedCookieOptions, maxAge: stateMaxAge },
  )

  return response
}
