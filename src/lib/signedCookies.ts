import { createHmac, timingSafeEqual } from 'crypto'

/*
 * Tamper-proof cookie values for visitors without an account.
 * The value is base64url JSON plus an HMAC signed with PAYLOAD_SECRET,
 * and carries its own expiry.
 */

type Signed<T> = T & { exp: number }

function sign(value: string) {
  return createHmac('sha256', process.env.PAYLOAD_SECRET || '')
    .update(value)
    .digest('base64url')
}

export function readCookie(headers: Headers, name: string) {
  const cookieHeader = headers.get('cookie') || ''

  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=')

    if (key === name) return rest.join('=')
  }

  return null
}

export function createSignedValue<T extends object>(data: T, maxAgeSeconds: number) {
  const body = Buffer.from(
    JSON.stringify({ ...data, exp: Date.now() + maxAgeSeconds * 1000 }),
  ).toString('base64url')

  return `${body}.${sign(body)}`
}

export function readSignedValue<T extends object>(value: string | null | undefined): T | null {
  if (!value) return null

  const [body, signature] = value.split('.')

  if (!body || !signature) return null

  const expected = Buffer.from(sign(body))
  const actual = Buffer.from(signature)

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as Signed<T>

    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null

    return data
  } catch {
    return null
  }
}

export const signedCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const
