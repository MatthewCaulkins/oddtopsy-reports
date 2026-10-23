import { createHash, randomBytes } from 'crypto'
import { CognitoJwtVerifier } from 'aws-jwt-verify'

import type { CognitoConfig } from '@/lib/auth/config'

/*
 * Cognito hosted sign-in (OAuth 2.0 authorization code + PKCE).
 *
 * The browser keeps the ID token and refresh token in httpOnly cookies.
 * src/proxy.ts refreshes the ID token before it expires; the Payload
 * auth strategy only verifies it and maps its `sub` to a User.
 */

export const idTokenCookie = 'oddtopsy-cognito-id'
export const refreshTokenCookie = 'oddtopsy-cognito-refresh'
export const oauthStateCookie = 'oddtopsy-cognito-oauth'

// Keep in step with the app client's refresh token lifetime (5 days).
export const sessionMaxAge = 5 * 24 * 60 * 60

export const cognitoCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const

export type CognitoIdentity = {
  sub: string
  email?: string
}

type TokenResponse = {
  id_token: string
  access_token: string
  refresh_token?: string
  expires_in: number
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create<{ userPoolId: string; tokenUse: 'id'; clientId: string }>> | null = null

export function getIdTokenVerifier(config: CognitoConfig) {
  verifier ??= CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'id',
    clientId: config.clientId,
  })

  return verifier
}

/*
 * Verifies signature, issuer, audience (our app client), expiry and
 * token use. Returns null for anything that does not verify.
 */
export async function verifyIdToken(
  config: CognitoConfig,
  token: string | null | undefined,
): Promise<CognitoIdentity | null> {
  if (!token) return null

  try {
    const claims = await getIdTokenVerifier(config).verify(token)

    return {
      sub: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : undefined,
    }
  } catch {
    return null
  }
}

function clientAuthorization(config: CognitoConfig) {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
}

async function tokenRequest(config: CognitoConfig, params: Record<string, string>) {
  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: clientAuthorization(config),
    },
    body: new URLSearchParams(params),
  })

  if (!response.ok) {
    // Cognito returns e.g. {"error":"invalid_grant"}; never include tokens in errors.
    const detail = await response.json().catch(() => ({}))
    throw new Error(`Cognito token request failed (${response.status} ${detail.error || ''})`.trim())
  }

  return (await response.json()) as TokenResponse
}

export function exchangeAuthorizationCode(config: CognitoConfig, code: string, codeVerifier: string) {
  return tokenRequest(config, {
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectURI,
    code_verifier: codeVerifier,
  })
}

export function refreshIdToken(config: CognitoConfig, refreshToken: string) {
  return tokenRequest(config, {
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken,
  })
}

export async function revokeRefreshToken(config: CognitoConfig, refreshToken: string) {
  await fetch(`${config.domain}/oauth2/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: clientAuthorization(config),
    },
    body: new URLSearchParams({ token: refreshToken, client_id: config.clientId }),
  }).catch(() => undefined)
}

export function createPKCE() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')

  return { verifier, challenge }
}

export function authorizeURL(config: CognitoConfig, state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectURI,
    scope: 'openid email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `${config.domain}/oauth2/authorize?${params}`
}

export function logoutURL(config: CognitoConfig) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutURI,
  })

  return `${config.domain}/logout?${params}`
}

/*
 * True when a JWT's exp is missing or within `seconds` of now. Only
 * decodes the payload; verification happens in verifyIdToken.
 */
export function expiresWithin(token: string, seconds: number) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())

    return typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now() + seconds * 1000
  } catch {
    return true
  }
}

/*
 * Only same-site paths may be used as the post-sign-in destination.
 */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/'
  }

  return value
}
