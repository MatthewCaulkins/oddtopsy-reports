// @vitest-environment node
import { createHash, generateKeyPairSync, createSign, type KeyObject } from 'crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Offline tests for the Cognito integration: tokens are signed with a
 * local RSA key whose JWKS is handed to the verifier, so signature,
 * issuer, audience, expiry and token-use checks all run for real.
 */

const REGION = 'us-east-1'
const POOL = 'us-east-1_TESTPOOL'
const CLIENT = 'test-client-id'
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL}`

const cognitoEnv = {
  AUTH_PROVIDERS: 'password,cognito',
  SITE_URL: 'https://oddtopsies.example',
  COGNITO_REGION: REGION,
  COGNITO_USER_POOL_ID: POOL,
  COGNITO_CLIENT_ID: CLIENT,
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_DOMAIN: 'test.auth.us-east-1.amazoncognito.com',
}

const authEnvKeys = ['AUTH_PROVIDERS', ...Object.keys(cognitoEnv)]

function setEnv(values: Record<string, string | undefined>) {
  for (const key of authEnvKeys) delete process.env[key]
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value
  }
}

const b64url = (value: object | Buffer) =>
  (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString('base64url')

let signingKey: KeyObject
let otherKey: KeyObject
let jwk: Record<string, unknown>

function signToken(claims: Record<string, unknown>, key = signingKey, kid = 'test-kid') {
  const header = b64url({ alg: 'RS256', kid, typ: 'JWT' })
  const body = b64url(claims)
  const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(key)

  return `${header}.${body}.${b64url(signature)}`
}

function idToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)

  return signToken({
    sub: 'sub-123',
    email: 'staff@example.com',
    iss: ISSUER,
    aud: CLIENT,
    token_use: 'id',
    auth_time: now,
    iat: now,
    exp: now + 3600,
    ...overrides,
  })
}

beforeAll(() => {
  signingKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey

  const publicJwk = signingKey.export({ format: 'jwk' }) as Record<string, unknown>
  jwk = { kty: publicJwk.kty, n: publicJwk.n, e: publicJwk.e, kid: 'test-kid', alg: 'RS256', use: 'sig' }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function loadCognito() {
  setEnv(cognitoEnv)
  const configModule = await import('@/lib/auth/config')
  const cognito = await import('@/lib/auth/cognito')
  const config = configModule.getAuthConfig().cognito!

  cognito.getIdTokenVerifier(config).cacheJwks({ keys: [jwk] } as never, POOL)

  return { config, cognito }
}

describe('AUTH_PROVIDERS', () => {
  it('defaults to password only, with no Cognito requirements', async () => {
    setEnv({})
    const { getAuthConfig } = await import('@/lib/auth/config')

    expect(getAuthConfig()).toEqual({ providers: ['password'], password: true, cognito: null })
  })

  it('enables both methods during the transition', async () => {
    setEnv(cognitoEnv)
    const { getAuthConfig } = await import('@/lib/auth/config')
    const config = getAuthConfig()

    expect(config.password).toBe(true)
    expect(config.cognito).toMatchObject({
      domain: 'https://test.auth.us-east-1.amazoncognito.com',
      redirectURI: 'https://oddtopsies.example/auth/callback',
      logoutURI: 'https://oddtopsies.example/',
    })
  })

  it('supports Cognito only', async () => {
    setEnv({ ...cognitoEnv, AUTH_PROVIDERS: 'cognito' })
    const { getAuthConfig } = await import('@/lib/auth/config')

    expect(getAuthConfig().password).toBe(false)
  })

  it('refuses to start when a Cognito setting is missing', async () => {
    setEnv({ ...cognitoEnv, COGNITO_CLIENT_SECRET: undefined })
    const { getAuthConfig } = await import('@/lib/auth/config')

    expect(() => getAuthConfig()).toThrow(/COGNITO_CLIENT_SECRET/)
  })

  it('refuses unknown provider names', async () => {
    setEnv({ AUTH_PROVIDERS: 'password,saml' })
    const { getAuthConfig } = await import('@/lib/auth/config')

    expect(() => getAuthConfig()).toThrow(/saml/)
  })

  it('refuses an empty provider list', async () => {
    setEnv({ AUTH_PROVIDERS: ' , ' })
    const { getAuthConfig } = await import('@/lib/auth/config')

    expect(() => getAuthConfig()).toThrow(/at least one/)
  })
})

describe('Cognito ID token verification', () => {
  it('accepts a valid ID token for our app client', async () => {
    const { config, cognito } = await loadCognito()

    expect(await cognito.verifyIdToken(config, idToken())).toEqual({ sub: 'sub-123', email: 'staff@example.com' })
  })

  it.each([
    ['another app client', { aud: 'someone-else' }],
    ['another user pool', { iss: `https://cognito-idp.${REGION}.amazonaws.com/us-east-1_OTHER` }],
    ['an access token', { token_use: 'access' }],
    ['an expired token', { exp: Math.floor(Date.now() / 1000) - 60 }],
  ])('rejects %s', async (_label, overrides) => {
    const { config, cognito } = await loadCognito()

    expect(await cognito.verifyIdToken(config, idToken(overrides))).toBeNull()
  })

  it('rejects a token signed by a different key', async () => {
    const { config, cognito } = await loadCognito()
    const now = Math.floor(Date.now() / 1000)
    const forged = signToken(
      { sub: 'sub-123', iss: ISSUER, aud: CLIENT, token_use: 'id', iat: now, exp: now + 3600 },
      otherKey,
    )

    expect(await cognito.verifyIdToken(config, forged)).toBeNull()
  })

  it('rejects garbage and missing tokens', async () => {
    const { config, cognito } = await loadCognito()

    expect(await cognito.verifyIdToken(config, 'not.a.jwt')).toBeNull()
    expect(await cognito.verifyIdToken(config, undefined)).toBeNull()
  })
})

describe('Cognito Payload strategy', () => {
  type FakeUser = { id: number; email: string; role: string; accountStatus: string; cognitoSub: string }

  function fakePayload(users: FakeUser[]) {
    const updates: unknown[] = []

    return {
      updates,
      payload: {
        find: vi.fn(async ({ where }: { where: { cognitoSub: { equals: string } } }) => ({
          docs: users.filter((user) => user.cognitoSub === where.cognitoSub.equals).map((user) => ({ ...user })),
        })),
        db: { updateOne: vi.fn(async (args: unknown) => updates.push(args)) },
      },
    }
  }

  async function authenticate(token: string | null, users: FakeUser[]) {
    const { config } = await loadCognito()
    const { cognitoStrategy } = await import('@/lib/auth/cognitoStrategy')
    const { idTokenCookie } = await import('@/lib/auth/cognito')
    const fake = fakePayload(users)
    const headers = new Headers(token ? { cookie: `${idTokenCookie}=${token}` } : {})

    const result = await cognitoStrategy(config).authenticate({ headers, payload: fake.payload } as never)

    return { result, fake }
  }

  const active: FakeUser = { id: 7, email: 'staff@example.com', role: 'admin', accountStatus: 'active', cognitoSub: 'sub-123' }

  it('signs in the user linked by sub', async () => {
    const { result } = await authenticate(idToken(), [active])

    expect(result.user).toMatchObject({ id: 7, collection: 'users', _strategy: 'cognito' })
  })

  it('never matches by email: an unlinked identity gets no user', async () => {
    const { result, fake } = await authenticate(idToken({ sub: 'sub-unlinked' }), [active])

    expect(result.user).toBeNull()
    expect(fake.payload.find).toHaveBeenCalledWith(expect.objectContaining({ where: { cognitoSub: { equals: 'sub-unlinked' } } }))
  })

  it('refuses disabled accounts', async () => {
    const { result } = await authenticate(idToken(), [{ ...active, accountStatus: 'disabled' }])

    expect(result.user).toBeNull()
  })

  it('activates an invited account on first sign-in', async () => {
    const { result, fake } = await authenticate(idToken(), [{ ...active, accountStatus: 'invited' }])

    expect(result.user).toMatchObject({ accountStatus: 'active' })
    expect(fake.updates).toEqual([expect.objectContaining({ id: 7, data: { accountStatus: 'active' } })])
  })

  it('ignores requests without a Cognito session', async () => {
    const { result, fake } = await authenticate(null, [active])

    expect(result.user).toBeNull()
    expect(fake.payload.find).not.toHaveBeenCalled()
  })
})

describe('token refresh proxy', () => {
  async function runProxy(cookies: Record<string, string>, tokenResponse: { ok: boolean; body: object }) {
    await loadCognito()
    const fetchMock = vi.fn(async () => ({ ok: tokenResponse.ok, status: tokenResponse.ok ? 200 : 400, json: async () => tokenResponse.body }))
    vi.stubGlobal('fetch', fetchMock)

    const { NextRequest } = await import('next/server')
    const { proxy } = await import('@/proxy')
    const cookie = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')

    const response = await proxy(new NextRequest('https://oddtopsies.example/editorial', { headers: { cookie } }))

    return { response, fetchMock }
  }

  it('refreshes an expiring ID token and sets the new cookie', async () => {
    const { idTokenCookie, refreshTokenCookie } = await import('@/lib/auth/cognito')
    const fresh = idToken()
    const { response, fetchMock } = await runProxy(
      { [idTokenCookie]: idToken({ exp: Math.floor(Date.now() / 1000) + 10 }), [refreshTokenCookie]: 'refresh-abc' },
      { ok: true, body: { id_token: fresh, access_token: 'a', expires_in: 3600 } },
    )

    expect(fetchMock).toHaveBeenCalledWith('https://test.auth.us-east-1.amazoncognito.com/oauth2/token', expect.anything())
    expect(String((fetchMock.mock.calls[0] as unknown[])[1] && ((fetchMock.mock.calls[0] as unknown[])[1] as { body: URLSearchParams }).body)).toContain('grant_type=refresh_token')
    expect(response.cookies.get(idTokenCookie)?.value).toBe(fresh)
    expect(response.cookies.get(idTokenCookie)?.httpOnly).toBe(true)
  })

  it('leaves a fresh token alone', async () => {
    const { idTokenCookie, refreshTokenCookie } = await import('@/lib/auth/cognito')
    const { fetchMock } = await runProxy(
      { [idTokenCookie]: idToken(), [refreshTokenCookie]: 'refresh-abc' },
      { ok: true, body: {} },
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ends the session when the refresh token is rejected', async () => {
    const { idTokenCookie, refreshTokenCookie } = await import('@/lib/auth/cognito')
    const { response } = await runProxy(
      { [idTokenCookie]: idToken({ exp: 1 }), [refreshTokenCookie]: 'revoked' },
      { ok: false, body: { error: 'invalid_grant' } },
    )

    expect(response.cookies.get(idTokenCookie)?.value).toBe('')
    expect(response.cookies.get(refreshTokenCookie)?.value).toBe('')
  })
})

describe('sign-in helpers', () => {
  it('only allows same-site return paths', async () => {
    const { safeNextPath } = await import('@/lib/auth/cognito')

    expect(safeNextPath('/admin')).toBe('/admin')
    expect(safeNextPath('//evil.example')).toBe('/')
    expect(safeNextPath('/\\evil.example')).toBe('/')
    expect(safeNextPath('https://evil.example')).toBe('/')
    expect(safeNextPath(null)).toBe('/')
  })

  it('builds a PKCE S256 challenge from the verifier', async () => {
    const { createPKCE } = await import('@/lib/auth/cognito')
    const { verifier, challenge } = createPKCE()

    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  it('asks Cognito for an authorization code with PKCE and our callback', async () => {
    const { config, cognito } = await loadCognito()
    const url = new URL(cognito.authorizeURL(config, 'state-1', 'challenge-1'))

    expect(url.origin + url.pathname).toBe('https://test.auth.us-east-1.amazoncognito.com/oauth2/authorize')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: CLIENT,
      redirect_uri: 'https://oddtopsies.example/auth/callback',
      scope: 'openid email',
      state: 'state-1',
      code_challenge: 'challenge-1',
      code_challenge_method: 'S256',
    })
  })
})

describe('role rules', () => {
  beforeEach(() => setEnv({}))

  const admin = { id: 1, role: 'admin' as const, accountStatus: 'active' as const }
  const otherAdmin = { id: 2, role: 'admin' as const, accountStatus: 'active' as const }
  const manager = { id: 3, role: 'manager' as const, accountStatus: 'active' as const }
  const otherManager = { id: 4, role: 'manager' as const, accountStatus: 'active' as const }
  const editor = { id: 5, role: 'editor' as const, accountStatus: 'active' as const }

  it('lets admins grant admin to others', async () => {
    const { canAssignRole } = await import('@/access/roles')

    expect(canAssignRole(admin, editor, 'admin')).toBe(true)
    expect(canAssignRole(admin, otherAdmin, 'editor')).toBe(true)
  })

  it('never lets anyone change their own account', async () => {
    const { canAssignRole, canSetAccountStatus } = await import('@/access/roles')

    expect(canAssignRole(admin, admin, 'editor')).toBe(false)
    expect(canSetAccountStatus(admin, admin, 'disabled')).toBe(false)
    expect(canAssignRole(manager, manager, 'editor')).toBe(false)
  })

  it('keeps managers to editors and away from admin', async () => {
    const { canAssignRole, canGrantOnApproval } = await import('@/access/roles')

    expect(canAssignRole(manager, editor, 'manager')).toBe(true)
    expect(canAssignRole(manager, editor, 'admin')).toBe(false)
    expect(canAssignRole(manager, otherManager, 'editor')).toBe(false)
    expect(canAssignRole(manager, admin, 'editor')).toBe(false)
    expect(canGrantOnApproval(manager, 'admin')).toBe(false)
    expect(canGrantOnApproval(admin, 'admin')).toBe(false)
  })

  it('gives disabled or invited accounts no rights', async () => {
    const { canAssignRole, hasRole } = await import('@/access/roles')

    expect(hasRole({ ...admin, accountStatus: 'disabled' }, 'editor')).toBe(false)
    expect(canAssignRole({ ...admin, accountStatus: 'invited' }, editor, 'manager')).toBe(false)
  })
})
