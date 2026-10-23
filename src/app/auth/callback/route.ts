import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { getAuthConfig } from '@/lib/auth/config'
import {
  cognitoCookieOptions,
  exchangeAuthorizationCode,
  idTokenCookie,
  oauthStateCookie,
  refreshTokenCookie,
  sessionMaxAge,
  verifyIdToken,
} from '@/lib/auth/cognito'
import { findCognitoUser } from '@/lib/auth/cognitoStrategy'
import { readCookie, readSignedValue } from '@/lib/signedCookies'

type OAuthState = {
  state: string
  verifier: string
  next: string
}

// Relative redirects: behind the load balancer request.url may carry the internal host.
function redirect(location: string) {
  const response = new NextResponse(null, { status: 303, headers: { Location: location } })
  response.cookies.delete(oauthStateCookie)
  return response
}

/*
 * Cognito returns here after sign-in. The session is only created for
 * an identity Payload has linked to an active (or invited) account.
 */
export async function GET(request: Request) {
  const cognito = getAuthConfig().cognito

  if (!cognito) return redirect('/login')

  const params = new URL(request.url).searchParams
  const saved = readSignedValue<OAuthState>(readCookie(request.headers, oauthStateCookie))

  if (params.get('error') || !saved || !params.get('code') || params.get('state') !== saved.state) {
    return redirect('/login?error=signin_failed')
  }

  const payload = await getPayload({ config })

  try {
    const tokens = await exchangeAuthorizationCode(cognito, params.get('code')!, saved.verifier)
    const identity = await verifyIdToken(cognito, tokens.id_token)

    if (!identity || !tokens.refresh_token) {
      return redirect('/login?error=signin_failed')
    }

    const user = await findCognitoUser(payload, identity.sub)

    if (!user) {
      payload.logger.warn(`Cognito sign-in for an unlinked or disabled identity (sub ${identity.sub})`)
      return redirect('/login?error=not_authorized')
    }

    const response = redirect(saved.next)

    response.cookies.set(idTokenCookie, tokens.id_token, { ...cognitoCookieOptions, maxAge: sessionMaxAge })
    response.cookies.set(refreshTokenCookie, tokens.refresh_token, {
      ...cognitoCookieOptions,
      maxAge: sessionMaxAge,
    })

    return response
  } catch (error) {
    payload.logger.error({ err: error }, 'Cognito sign-in failed')
    return redirect('/login?error=signin_failed')
  }
}
