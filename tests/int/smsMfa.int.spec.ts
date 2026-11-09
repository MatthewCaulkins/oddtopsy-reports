// @vitest-environment node
import { createSign, generateKeyPairSync, type KeyObject } from 'crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * SMS MFA agreement: the server actions, page status and step-up
 * sign-in, run offline. Cognito is an in-memory fake behind the SDK's
 * own command classes (no network, no real SMS); tokens are signed with
 * a local key so the real verifier checks signature, client, scope and
 * sign-in time. Payload is a fake holding the user records.
 */

const REGION = 'us-east-1'
const POOL = 'us-east-1_TESTPOOL'
const CLIENT = 'test-client-id'
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL}`

const cognitoEnv: Record<string, string> = {
  AUTH_PROVIDERS: 'cognito',
  SITE_URL: 'https://oddtopsies.example',
  COGNITO_REGION: REGION,
  COGNITO_USER_POOL_ID: POOL,
  COGNITO_CLIENT_ID: CLIENT,
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_DOMAIN: 'test.auth.us-east-1.amazoncognito.com',
}

const PHONE = '+12055550123'
const CODE = '246810'

let signingKey: KeyObject
let jwk: Record<string, unknown>

const b64url = (value: object | Buffer) =>
  (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString('base64url')

function signToken(claims: Record<string, unknown>) {
  const header = b64url({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' })
  const body = b64url(claims)
  const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(signingKey)

  return `${header}.${body}.${b64url(signature)}`
}

function accessToken(sub: string, overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)

  return signToken({
    sub,
    iss: ISSUER,
    client_id: CLIENT,
    token_use: 'access',
    scope: 'openid email aws.cognito.signin.user.admin',
    auth_time: now - 30,
    iat: now,
    exp: now + 3600,
    ...overrides,
  })
}

function idToken(sub: string) {
  const now = Math.floor(Date.now() / 1000)

  return signToken({ sub, email: `${sub}@example.com`, iss: ISSUER, aud: CLIENT, token_use: 'id', auth_time: now, iat: now, exp: now + 3600 })
}

/*
 * Fake Cognito: just enough of the user pool's behaviour.
 */
type CognitoUser = { attrs: Record<string, string>; mfa: Set<string>; preferred?: string; code?: string }

const cognito = {
  users: {} as Record<string, CognitoUser>,
  calls: [] as string[],
  failNext: {} as Record<string, string>,
}

function cognitoError(name: string) {
  return Object.assign(new Error(`${name}: details may include ${PHONE}`), { name })
}

function subFromToken(token: string) {
  const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub as string

  if (!cognito.users[sub]) throw cognitoError('NotAuthorizedException')

  return sub
}

function describeUser(user: CognitoUser) {
  return {
    UserAttributes: Object.entries(user.attrs).map(([Name, Value]) => ({ Name, Value })),
    UserMFASettingList: [...user.mfa],
    PreferredMfaSetting: user.preferred,
  }
}

function handle(name: string, input: Record<string, any>) {
  cognito.calls.push(name)

  if (cognito.failNext[name]) {
    const error = cognito.failNext[name]
    delete cognito.failNext[name]
    throw cognitoError(error)
  }

  if (name === 'AdminGetUserCommand') {
    const user = cognito.users[input.Username]
    if (!user) throw cognitoError('UserNotFoundException')
    return describeUser(user)
  }

  const user = cognito.users[subFromToken(input.AccessToken)]

  switch (name) {
    case 'GetUserCommand':
      return describeUser(user)
    case 'UpdateUserAttributesCommand':
      for (const attribute of input.UserAttributes) user.attrs[attribute.Name] = attribute.Value
      // Like this pool: phone numbers are not auto-verified, so no code is sent here.
      user.attrs.phone_number_verified = 'false'
      return { CodeDeliveryDetailsList: [] }
    case 'GetUserAttributeVerificationCodeCommand':
      if (!user.attrs.phone_number) throw cognitoError('InvalidParameterException')
      user.code = CODE
      return { CodeDeliveryDetails: { Destination: '+*******0123', DeliveryMedium: 'SMS', AttributeName: 'phone_number' } }
    case 'VerifyUserAttributeCommand':
      if (!user.code || input.Code !== user.code) throw cognitoError('CodeMismatchException')
      user.attrs.phone_number_verified = 'true'
      user.code = undefined
      return {}
    case 'SetUserMFAPreferenceCommand': {
      const apply = (method: string, settings?: { Enabled: boolean; PreferredMfa: boolean }) => {
        if (!settings) return
        if (settings.Enabled) user.mfa.add(method)
        else user.mfa.delete(method)
        if (settings.PreferredMfa) user.preferred = method
        else if (user.preferred === method) user.preferred = undefined
      }
      if (input.SMSMfaSettings?.Enabled && !user.attrs.phone_number) throw cognitoError('InvalidParameterException')
      apply('SMS_MFA', input.SMSMfaSettings)
      apply('EMAIL_OTP', input.EmailMfaSettings)
      return {}
    }
    case 'DeleteUserAttributesCommand':
      for (const attribute of input.UserAttributeNames) {
        delete user.attrs[attribute]
        if (attribute === 'phone_number') delete user.attrs.phone_number_verified
      }
      return {}
  }

  throw new Error(`Unexpected command ${name}`)
}

function mockCognitoSDK() {
  vi.doMock('@aws-sdk/client-cognito-identity-provider', () => {
    const command = (name: string) =>
      ({
        [name]: class {
          constructor(public input: Record<string, unknown>) {}
          get commandName() {
            return name
          }
        },
      })[name]

    const names = [
      'AdminGetUserCommand',
      'GetUserCommand',
      'UpdateUserAttributesCommand',
      'GetUserAttributeVerificationCodeCommand',
      'VerifyUserAttributeCommand',
      'SetUserMFAPreferenceCommand',
      'DeleteUserAttributesCommand',
    ]

    return {
      CognitoIdentityProviderClient: class {
        async send(cmd: { commandName: string; input: Record<string, unknown> }) {
          return handle(cmd.commandName, cmd.input)
        }
      },
      ...Object.fromEntries(names.map((name) => [name, command(name)])),
    }
  })
}

/*
 * Fake Payload and Next request context.
 */
type FakeUser = {
  id: number
  email: string
  role: string
  accountStatus: string
  cognitoSub: string | null
  smsMfaEnabled?: boolean | null
  smsMfaPhoneNumber?: string | null
  smsMfaConsentedAt?: string | null
  smsMfaTermsAccepted?: boolean | null
}

const store = {
  users: {} as Record<number, FakeUser>,
  session: null as number | null,
  failUpdate: false,
  logs: [] as unknown[],
  emails: [] as unknown[][],
  jar: new Map<string, { value: string; options?: Record<string, unknown> }>(),
}

const fakePayload = {
  auth: vi.fn(async () => ({ user: store.session ? { ...store.users[store.session] } : null })),
  findByID: vi.fn(async ({ id }: { id: number }) => ({ ...store.users[id] })),
  update: vi.fn(async ({ id, data }: { id: number; data: Partial<FakeUser> }) => {
    if (store.failUpdate) throw new Error('database unavailable')
    store.users[id] = { ...store.users[id], ...data }
    return { ...store.users[id] }
  }),
  logger: {
    info: (...args: unknown[]) => store.logs.push(args),
    warn: (...args: unknown[]) => store.logs.push(args),
    error: (...args: unknown[]) => store.logs.push(args),
  },
}

function mockRequest() {
  vi.doMock('payload', () => ({ getPayload: async () => fakePayload }))
  vi.doMock('@/payload.config', () => ({ default: {} }))
  vi.doMock('next/headers', () => ({
    headers: async () => new Headers(),
    cookies: async () => ({
      get: (name: string) => (store.jar.has(name) ? { name, value: store.jar.get(name)!.value } : undefined),
      set: (name: string, value: string, options?: Record<string, unknown>) => store.jar.set(name, { value, options }),
      delete: (arg: string | { name: string }) => store.jar.delete(typeof arg === 'string' ? arg : arg.name),
    }),
  }))
  vi.doMock('next/navigation', () => ({
    redirect: (url: string) => {
      throw Object.assign(new Error(`redirect ${url}`), { digest: `NEXT_REDIRECT;${url}` })
    },
    unstable_rethrow: (error: unknown) => {
      if ((error as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw error
    },
  }))
  vi.doMock('next/server', async (importOriginal) => ({
    ...(await importOriginal<typeof import('next/server')>()),
    after: async (callback: () => Promise<unknown>) => callback(),
  }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
  vi.doMock('@/lib/notifications', () => ({
    siteURL: 'https://oddtopsies.example',
    notifyUserOfSmsMfaChange: vi.fn(async (_payload: unknown, user: FakeUser, change: string, hint: string) =>
      store.emails.push([user.email, change, hint]),
    ),
  }))
}

async function load() {
  const cognitoMfa = await import('@/lib/auth/cognitoMfa')
  const { getAuthConfig } = await import('@/lib/auth/config')
  const config = getAuthConfig().cognito!

  cognitoMfa.getAccessTokenVerifier(config).cacheJwks({ keys: [jwk] } as never, POOL)

  const actions = await import('@/app/(frontend)/editorial/account/security/actions')
  const smsMfa = await import('@/lib/smsMfa')

  return { actions, smsMfa, cognitoMfa, config }
}

function addEditor(id: number, sub: string | null, extra: Partial<FakeUser> = {}) {
  store.users[id] = { id, email: `editor${id}@example.com`, role: 'editor', accountStatus: 'active', cognitoSub: sub, ...extra }

  if (sub) cognito.users[sub] = { attrs: { email: `editor${id}@example.com`, email_verified: 'true' }, mfa: new Set() }
}

function signIn(id: number, { stepUp = true, token }: { stepUp?: boolean; token?: string } = {}) {
  store.session = id
  store.jar.clear()

  if (stepUp) store.jar.set('oddtopsy-cognito-mfa', { value: token || accessToken(store.users[id].cognitoSub!) })
}

function enrollForm({ phone = PHONE, consent = true, terms = true } = {}) {
  const data = new FormData()
  data.set('phoneNumber', phone)
  if (consent) data.set('smsConsent', 'yes')
  if (terms) data.set('termsAccepted', 'yes')
  return data
}

beforeAll(() => {
  signingKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  const publicJwk = signingKey.export({ format: 'jwk' }) as Record<string, unknown>
  jwk = { kty: publicJwk.kty, n: publicJwk.n, e: publicJwk.e, kid: 'test-kid', alg: 'RS256', use: 'sig' }
})

beforeEach(() => {
  for (const [key, value] of Object.entries(cognitoEnv)) process.env[key] = value
  process.env.PAYLOAD_SECRET ||= 'test-payload-secret'

  cognito.users = {}
  cognito.calls = []
  cognito.failNext = {}
  store.users = {}
  store.session = null
  store.failUpdate = false
  store.logs = []
  store.emails = []
  store.jar.clear()

  mockCognitoSDK()
  mockRequest()
})

afterEach(() => {
  for (const name of [
    '@aws-sdk/client-cognito-identity-provider',
    'payload',
    '@/payload.config',
    'next/headers',
    'next/navigation',
    'next/server',
    'next/cache',
    '@/lib/notifications',
  ]) {
    vi.doUnmock(name)
  }
  vi.resetModules()
  vi.unstubAllGlobals()
  for (const key of Object.keys(cognitoEnv)) delete process.env[key]
})

describe('phone number validation', () => {
  it('accepts E.164 numbers, tolerating spaces and punctuation, and rejects the rest', async () => {
    const { normalizePhoneNumber, phoneNumberHint } = await import('@/lib/validation')

    expect(normalizePhoneNumber('+1 (205) 555-0123')).toBe(PHONE)
    expect(normalizePhoneNumber('+44 20 7946 0958')).toBe('+442079460958')
    expect(normalizePhoneNumber('2055550123')).toBeNull()
    expect(normalizePhoneNumber('+0123456789')).toBeNull()
    expect(normalizePhoneNumber('+1205555012345678')).toBeNull()
    expect(normalizePhoneNumber('+1205abc0123')).toBeNull()
    expect(normalizePhoneNumber(null)).toBeNull()
    expect(phoneNumberHint(PHONE)).toBe('ending in 0123')
  })
})

describe('access to the MFA Agreement page and actions', () => {
  it('sends anonymous visitors to sign in, and changes nothing', async () => {
    const { actions } = await load()

    await expect(actions.startSmsEnrollment(enrollForm())).rejects.toThrow(/redirect \/auth\/login/)
    await expect(actions.disableSmsMfa()).rejects.toThrow(/redirect \/auth\/login/)

    expect(cognito.calls).toEqual([])
  })

  it('refuses accounts without editorial access (disabled or invited)', async () => {
    addEditor(1, 'sub-a', { accountStatus: 'disabled' })
    addEditor(2, 'sub-b', { accountStatus: 'invited' })
    const { actions } = await load()

    for (const id of [1, 2]) {
      signIn(id)
      await expect(actions.startSmsEnrollment(enrollForm())).rejects.toThrow('redirect /articles')
    }

    expect(cognito.calls).toEqual([])
  })

  it('shows an editor their own status from Payload and Cognito', async () => {
    addEditor(1, 'sub-a')
    const { smsMfa, config } = await load()

    const view = await smsMfa.buildSmsMfaView({
      payload: fakePayload as never,
      user: store.users[1] as never,
      cognito: config,
      stepUpExpiresAt: null,
      enrollment: null,
    })

    expect(view).toMatchObject({ status: 'disabled', cognitoChecked: true, email: 'editor1@example.com' })
    expect(cognito.calls).toEqual(['AdminGetUserCommand'])
  })

  it('is unavailable, not broken, without Cognito or a linked account', async () => {
    addEditor(1, null)
    const { smsMfa, config } = await load()
    const input = { payload: fakePayload as never, user: store.users[1] as never, stepUpExpiresAt: null, enrollment: null }

    expect((await smsMfa.buildSmsMfaView({ ...input, cognito: null })).status).toBe('unavailable')
    expect((await smsMfa.buildSmsMfaView({ ...input, cognito: config })).status).toBe('unavailable')
  })
})

describe('step-up sign-in is required for changes', () => {
  it('asks for a fresh sign-in when there is no step-up token', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1, { stepUp: false })

    const result = await actions.startSmsEnrollment(enrollForm())

    expect(result).toMatchObject({ ok: false, reauth: true })
    expect(cognito.calls.filter((call) => call !== 'AdminGetUserCommand')).toEqual([])
  })

  it('refuses a token from an old sign-in, or without the self-service scope', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()

    signIn(1, { token: accessToken('sub-a', { auth_time: Math.floor(Date.now() / 1000) - 11 * 60 }) })
    expect(await actions.startSmsEnrollment(enrollForm())).toMatchObject({ ok: false, reauth: true })

    signIn(1, { token: accessToken('sub-a', { scope: 'openid email' }) })
    expect(await actions.startSmsEnrollment(enrollForm())).toMatchObject({ ok: false, reauth: true })

    expect(cognito.calls.filter((call) => call !== 'AdminGetUserCommand')).toEqual([])
  })

  it('never lets one editor change another editor’s settings', async () => {
    addEditor(1, 'sub-a')
    addEditor(2, 'sub-b')
    const { actions } = await load()

    // Signed in as editor 1, holding editor 2's step-up token.
    signIn(1, { token: accessToken('sub-b') })

    expect(await actions.startSmsEnrollment(enrollForm())).toMatchObject({ ok: false, reauth: true })
    expect(await actions.disableSmsMfa()).toMatchObject({ ok: false, reauth: true })
    expect(cognito.users['sub-b'].attrs.phone_number).toBeUndefined()
    expect(store.users[2].smsMfaEnabled).toBeUndefined()
  })
})

describe('SMS enrollment', () => {
  it('rejects invalid numbers and missing consent on the server, before calling Cognito', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1)

    expect((await actions.startSmsEnrollment(enrollForm({ phone: '205-555-0123' }))).error).toMatch(/international format/)
    expect((await actions.startSmsEnrollment(enrollForm({ consent: false }))).error).toMatch(/consent/)
    expect((await actions.startSmsEnrollment(enrollForm({ terms: false }))).error).toMatch(/Terms and Conditions/)

    expect(cognito.calls.filter((call) => call !== 'AdminGetUserCommand')).toEqual([])
    expect(cognito.users['sub-a'].attrs.phone_number).toBeUndefined()
  })

  it('sends a code but saves nothing in Payload until Cognito verifies it', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1)

    const started = await actions.startSmsEnrollment(enrollForm({ phone: '+1 205 555 0123' }))

    expect(started).toMatchObject({ ok: true, view: { status: 'pending', pendingDestination: '+*******0123' } })
    expect(cognito.users['sub-a'].attrs).toMatchObject({ phone_number: PHONE, phone_number_verified: 'false' })
    expect(cognito.users['sub-a'].mfa.has('SMS_MFA')).toBe(false)
    expect(store.users[1].smsMfaEnabled).toBeUndefined()

    const wrong = await actions.confirmSmsEnrollment('111111')

    expect(wrong).toMatchObject({ ok: false, view: { status: 'pending' } })
    expect(wrong.error).toMatch(/not correct/)
    expect(cognito.users['sub-a'].mfa.has('SMS_MFA')).toBe(false)
    expect(store.users[1].smsMfaEnabled).toBeUndefined()

    expect((await actions.confirmSmsEnrollment('12')).error).toMatch(/6-digit/)

    const before = Date.now()
    const confirmed = await actions.confirmSmsEnrollment(CODE)

    expect(confirmed).toMatchObject({ ok: true, view: { status: 'enabled', phoneHint: 'ending in 0123' } })
    expect(cognito.users['sub-a']).toMatchObject({ preferred: 'SMS_MFA' })
    expect([...cognito.users['sub-a'].mfa].sort()).toEqual(['EMAIL_OTP', 'SMS_MFA'])
    expect(cognito.users['sub-a'].attrs.phone_number_verified).toBe('true')
    expect(store.users[1]).toMatchObject({ smsMfaEnabled: true, smsMfaPhoneNumber: PHONE, smsMfaTermsAccepted: true })
    expect(Date.parse(store.users[1].smsMfaConsentedAt!)).toBeLessThanOrEqual(before)
    expect(store.jar.has('oddtopsy-sms-enrollment')).toBe(false)
    expect(store.emails).toEqual([['editor1@example.com', 'enabled', 'ending in 0123']])
  })

  it('cannot be confirmed without a code-backed enrollment from this session', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1)

    expect((await actions.confirmSmsEnrollment(CODE)).error).toMatch(/expired/)
    expect(cognito.calls).not.toContain('SetUserMFAPreferenceCommand')
    expect(store.users[1].smsMfaEnabled).toBeUndefined()
  })

  it('leaves Payload alone when Cognito fails to send the code or to turn on SMS', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1)

    cognito.failNext.GetUserAttributeVerificationCodeCommand = 'CodeDeliveryFailureException'
    const failedSend = await actions.startSmsEnrollment(enrollForm())

    expect(failedSend).toMatchObject({ ok: false, view: { status: 'disabled' } })
    expect(failedSend.error).toMatch(/sandbox/)
    // The unconfirmed number is taken back off the account.
    expect(cognito.users['sub-a'].attrs.phone_number).toBeUndefined()

    await actions.startSmsEnrollment(enrollForm())
    cognito.failNext.SetUserMFAPreferenceCommand = 'InvalidSmsRoleAccessPolicyException'
    const failedEnable = await actions.confirmSmsEnrollment(CODE)

    expect(failedEnable).toMatchObject({ ok: false, view: { status: 'pending', pendingVerified: true } })
    expect(cognito.users['sub-a'].mfa.has('SMS_MFA')).toBe(false)
    expect(store.users[1].smsMfaEnabled).toBeUndefined()

    // Retrying finishes without a second code: this enrollment's code was accepted.
    const retried = await actions.confirmSmsEnrollment('')
    expect(retried).toMatchObject({ ok: true, view: { status: 'enabled' } })
  })

  it('reports a Payload save failure accurately and can finish on retry', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1)

    await actions.startSmsEnrollment(enrollForm())
    store.failUpdate = true

    const failed = await actions.confirmSmsEnrollment(CODE)

    expect(failed).toMatchObject({ ok: false, view: { status: 'needs_attention', pendingVerified: true } })
    expect(failed.error).toMatch(/could not be saved/)
    expect(cognito.users['sub-a'].mfa.has('SMS_MFA')).toBe(true)
    expect(store.emails).toEqual([])

    store.failUpdate = false
    expect(await actions.confirmSmsEnrollment('')).toMatchObject({ ok: true, view: { status: 'enabled' } })
    expect(store.users[1].smsMfaEnabled).toBe(true)
  })

  it('refuses a number change while enrolled', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1)
    await actions.startSmsEnrollment(enrollForm())
    await actions.confirmSmsEnrollment(CODE)

    const change = await actions.startSmsEnrollment(enrollForm({ phone: '+12055559999' }))

    expect(change.error).toMatch(/turn it off first/)
    expect(cognito.users['sub-a'].attrs.phone_number).toBe(PHONE)
  })

  it('can be cancelled before it is confirmed', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1)
    await actions.startSmsEnrollment(enrollForm())

    expect(await actions.cancelSmsEnrollment()).toMatchObject({ ok: true, view: { status: 'disabled' } })
    expect(cognito.users['sub-a'].attrs.phone_number).toBeUndefined()
    expect(store.jar.has('oddtopsy-sms-enrollment')).toBe(false)
  })
})

describe('disabling SMS MFA', () => {
  async function enrolled() {
    addEditor(1, 'sub-a')
    const loaded = await load()
    signIn(1)
    await loaded.actions.startSmsEnrollment(enrollForm())
    await loaded.actions.confirmSmsEnrollment(CODE)
    store.emails = []
    return loaded
  }

  it('restores email as the preferred method, then clears the agreement', async () => {
    const { actions } = await enrolled()

    const result = await actions.disableSmsMfa()

    expect(result).toMatchObject({ ok: true, view: { status: 'disabled' } })
    expect(cognito.users['sub-a']).toMatchObject({ preferred: 'EMAIL_OTP' })
    expect([...cognito.users['sub-a'].mfa]).toEqual(['EMAIL_OTP'])
    expect(cognito.users['sub-a'].attrs.phone_number).toBeUndefined()
    // Unrelated attributes are untouched.
    expect(cognito.users['sub-a'].attrs).toMatchObject({ email: 'editor1@example.com', email_verified: 'true' })
    expect(store.users[1]).toMatchObject({
      smsMfaEnabled: false,
      smsMfaPhoneNumber: null,
      smsMfaConsentedAt: null,
      smsMfaTermsAccepted: false,
    })
    expect(store.emails).toEqual([['editor1@example.com', 'disabled', 'ending in 0123']])
  })

  it('keeps the agreement and the accurate status when Cognito refuses', async () => {
    const { actions } = await enrolled()

    cognito.failNext.SetUserMFAPreferenceCommand = 'TooManyRequestsException'
    const result = await actions.disableSmsMfa()

    expect(result).toMatchObject({ ok: false, view: { status: 'enabled' } })
    expect(cognito.users['sub-a'].mfa.has('SMS_MFA')).toBe(true)
    expect(store.users[1].smsMfaEnabled).toBe(true)
    expect(store.emails).toEqual([])
  })

  it('reports when Cognito is off but Payload could not be cleared, and the page repairs it', async () => {
    const { actions, smsMfa, config } = await enrolled()

    store.failUpdate = true
    const result = await actions.disableSmsMfa()

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/now go to your email/)
    expect(result.view.status).toBe('needs_attention')
    expect(cognito.users['sub-a'].mfa.has('SMS_MFA')).toBe(false)

    store.failUpdate = false
    const view = await smsMfa.buildSmsMfaView({
      payload: fakePayload as never,
      user: store.users[1] as never,
      cognito: config,
      stepUpExpiresAt: null,
      enrollment: null,
    })

    expect(view.status).toBe('disabled')
    expect(store.users[1].smsMfaEnabled).toBe(false)
  })

  it('supports enrolling and cancelling repeatedly, with a new consent time each time', async () => {
    const { actions } = await enrolled()
    const firstConsent = store.users[1].smsMfaConsentedAt

    await actions.disableSmsMfa()
    await new Promise((resolve) => setTimeout(resolve, 5))
    await actions.startSmsEnrollment(enrollForm({ phone: '+447700900123' }))
    expect(await actions.confirmSmsEnrollment(CODE)).toMatchObject({ ok: true, view: { status: 'enabled', phoneHint: 'ending in 0123' } })
    expect(store.users[1].smsMfaPhoneNumber).toBe('+447700900123')
    expect(store.users[1].smsMfaConsentedAt).not.toBe(firstConsent)

    expect(await actions.disableSmsMfa()).toMatchObject({ ok: true, view: { status: 'disabled' } })
    expect([...cognito.users['sub-a'].mfa]).toEqual(['EMAIL_OTP'])
  })
})

describe('status when Payload and Cognito disagree', () => {
  it('flags SMS that is active in Cognito without an agreement', async () => {
    addEditor(1, 'sub-a')
    cognito.users['sub-a'].attrs.phone_number = PHONE
    cognito.users['sub-a'].mfa.add('SMS_MFA')
    const { smsMfa, config } = await load()

    const view = await smsMfa.buildSmsMfaView({
      payload: fakePayload as never,
      user: store.users[1] as never,
      cognito: config,
      stepUpExpiresAt: null,
      enrollment: null,
    })

    expect(view.status).toBe('needs_attention')
  })

  it('flags a phone number changed outside the app', async () => {
    addEditor(1, 'sub-a', { smsMfaEnabled: true, smsMfaPhoneNumber: PHONE })
    cognito.users['sub-a'].attrs.phone_number = '+12055559999'
    cognito.users['sub-a'].mfa.add('SMS_MFA')
    const { smsMfa, config } = await load()

    const view = await smsMfa.buildSmsMfaView({
      payload: fakePayload as never,
      user: store.users[1] as never,
      cognito: config,
      stepUpExpiresAt: null,
      enrollment: null,
    })

    expect(view).toMatchObject({ status: 'needs_attention' })
    expect(view.detail).toMatch(/no longer matches/)
  })

  it('falls back to the saved agreement, and says so, when Cognito cannot be read', async () => {
    addEditor(1, 'sub-a', { smsMfaEnabled: true, smsMfaPhoneNumber: PHONE })
    cognito.failNext.AdminGetUserCommand = 'AccessDeniedException'
    const { smsMfa, config } = await load()

    const view = await smsMfa.buildSmsMfaView({
      payload: fakePayload as never,
      user: store.users[1] as never,
      cognito: config,
      stepUpExpiresAt: null,
      enrollment: null,
    })

    expect(view).toMatchObject({ status: 'enabled', cognitoChecked: false })
    expect(store.users[1].smsMfaEnabled).toBe(true)
  })
})

describe('logging', () => {
  it('never logs phone numbers or verification codes', async () => {
    addEditor(1, 'sub-a')
    const { actions } = await load()
    signIn(1)

    await actions.startSmsEnrollment(enrollForm())
    await actions.confirmSmsEnrollment('111111')
    cognito.failNext.SetUserMFAPreferenceCommand = 'InvalidParameterException'
    await actions.confirmSmsEnrollment(CODE)
    await actions.confirmSmsEnrollment('')
    await actions.disableSmsMfa()

    const logged = JSON.stringify(store.logs)

    expect(store.logs.length).toBeGreaterThan(0)
    expect(logged).not.toContain('5550123')
    expect(logged).not.toContain(CODE)
    expect(logged).not.toContain('111111')
  })
})

describe('sign-in: normal and step-up', () => {
  it('normal sign-in is unchanged: openid and email only, no forced prompt', async () => {
    const { authorizeURL } = await import('@/lib/auth/cognito')
    const { getAuthConfig } = await import('@/lib/auth/config')
    const config = getAuthConfig().cognito!

    const normal = new URL(authorizeURL(config, 'state', 'challenge'))
    expect(normal.searchParams.get('scope')).toBe('openid email')
    expect(normal.searchParams.has('prompt')).toBe(false)

    const stepUp = new URL(authorizeURL(config, 'state', 'challenge', { stepUp: true }))
    expect(stepUp.searchParams.get('scope')).toBe('openid email aws.cognito.signin.user.admin')
    expect(stepUp.searchParams.get('prompt')).toBe('login')
  })

  it('/auth/login starts a step-up only when asked', async () => {
    const { GET } = await import('@/app/auth/login/route')

    const normal = await GET(new Request('https://oddtopsies.example/auth/login?next=/editorial'))
    expect(new URL(normal.headers.get('location')!).searchParams.get('scope')).toBe('openid email')

    const stepUp = await GET(new Request('https://oddtopsies.example/auth/login?reauth=1&next=/editorial/account/security'))
    expect(new URL(stepUp.headers.get('location')!).searchParams.get('prompt')).toBe('login')
  })

  async function callback({ stepUp, access }: { stepUp: boolean; access: string }) {
    addEditor(1, 'sub-a')
    const fake = {
      ...fakePayload,
      find: vi.fn(async () => ({ docs: [{ ...store.users[1] }] })),
      db: { updateOne: vi.fn() },
    }
    vi.doMock('payload', () => ({ getPayload: async () => fake }))

    const { getIdTokenVerifier } = await import('@/lib/auth/cognito')
    const { getAccessTokenVerifier } = await import('@/lib/auth/cognitoMfa')
    const { getAuthConfig } = await import('@/lib/auth/config')
    const { createSignedValue } = await import('@/lib/signedCookies')
    const config = getAuthConfig().cognito!

    getIdTokenVerifier(config).cacheJwks({ keys: [jwk] } as never, POOL)
    getAccessTokenVerifier(config).cacheJwks({ keys: [jwk] } as never, POOL)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ id_token: idToken('sub-a'), access_token: access, refresh_token: 'refresh', expires_in: 3600 }),
      ),
    )

    const state = createSignedValue({ state: 's1', verifier: 'v1', next: '/editorial/account/security', stepUp }, 600)
    const { GET } = await import('@/app/auth/callback/route')

    return GET(
      new Request('https://oddtopsies.example/auth/callback?code=c1&state=s1', {
        headers: { cookie: `oddtopsy-cognito-oauth=${state}` },
      }),
    )
  }

  it('normal sign-in never keeps the access token', async () => {
    const response = await callback({ stepUp: false, access: accessToken('sub-a') })

    expect(response.headers.get('location')).toBe('/editorial/account/security')
    expect(response.cookies.get('oddtopsy-cognito-id')?.value).toBeTruthy()
    expect(response.cookies.get('oddtopsy-cognito-mfa')).toBeUndefined()
  })

  it('a step-up keeps a valid token briefly, scoped to the account pages', async () => {
    const response = await callback({ stepUp: true, access: accessToken('sub-a') })
    const cookie = response.cookies.get('oddtopsy-cognito-mfa')

    expect(response.headers.get('location')).toBe('/editorial/account/security')
    expect(cookie).toMatchObject({ path: '/editorial/account', maxAge: 600, httpOnly: true })
  })

  it('a step-up with an old sign-in time is refused', async () => {
    const response = await callback({
      stepUp: true,
      access: accessToken('sub-a', { auth_time: Math.floor(Date.now() / 1000) - 3600 }),
    })

    expect(response.headers.get('location')).toBe('/editorial/account/security?reauth=stale')
    expect(response.cookies.get('oddtopsy-cognito-mfa')).toBeUndefined()
    // Still signed in normally.
    expect(response.cookies.get('oddtopsy-cognito-id')?.value).toBeTruthy()
  })
})
