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
import { mfaAccessCookie, mfaCookiePath, recentAuthSeconds, verifyStepUpToken } from '@/lib/auth/cognitoMfa'
import { findCognitoUser } from '@/lib/auth/cognitoStrategy'
import { readCookie, readSignedValue } from '@/lib/signedCookies'

type OAuthState = {
  state: string
  verifier: string
  next: string
  stepUp?: boolean
}

// Where a failed step-up sign-in returns: the page that asked for it, with a reason.
function stepUpFailure(next: string, reason: string) {
  return redirect(`${next}${next.includes('?') ? '&' : '?'}reauth=${reason}`)
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

  // A step-up the app client refused (e.g. the self-service scope is not allowed) goes back to its page.
  if (saved?.stepUp && params.get('error') && params.get('state') === saved.state) {
    return stepUpFailure(saved.next, 'failed')
  }

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

    /*
     * Step-up: keep the access token, briefly and only for the MFA page,
     * if it is for this same person, carries the self-service scope and
     * comes from a sign-in that just happened. Otherwise sign-in still
     * succeeds, but no MFA change is possible until a step-up works.
     */
    let stepUpToken: string | null = null

    if (saved.stepUp) {
      const stepUp = await verifyStepUpToken(cognito, tokens.access_token)

      if (!stepUp || stepUp.sub !== identity.sub) {
        payload.logger.warn({ event: 'mfa.step_up_refused', userID: user.id }, 'Step-up sign-in did not produce a usable token')
      } else {
        stepUpToken = tokens.access_token
      }
    }

    const response = stepUpToken || !saved.stepUp ? redirect(saved.next) : stepUpFailure(saved.next, 'stale')

    if (stepUpToken) {
      response.cookies.set(mfaAccessCookie, stepUpToken, {
        ...cognitoCookieOptions,
        path: mfaCookiePath,
        maxAge: recentAuthSeconds,
      })
    }

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
