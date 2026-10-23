import type { AuthStrategy, Payload } from 'payload'

import type { CognitoConfig } from '@/lib/auth/config'
import { idTokenCookie, verifyIdToken } from '@/lib/auth/cognito'
import { readCookie } from '@/lib/signedCookies'
import type { User } from '@/payload-types'

/*
 * The Payload user a Cognito identity belongs to: matched only by the
 * Cognito `sub` stored when we provisioned the account, never by email.
 * Disabled accounts get nothing; an invited account becomes active on
 * its first Cognito sign-in.
 */
export async function findCognitoUser(payload: Payload, sub: string): Promise<User | null> {
  const result = await payload.find({
    collection: 'users',
    where: { cognitoSub: { equals: sub } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const user = result.docs[0]

  if (!user || user.accountStatus === 'disabled') return null

  if (user.accountStatus === 'invited') {
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { accountStatus: 'active' },
      returning: false,
    })

    user.accountStatus = 'active'
  }

  return user
}

/*
 * Runs on every request (site, API and /admin). Token refresh happens
 * earlier, in src/proxy.ts, so an expired token here simply means
 * "not signed in".
 */
export function cognitoStrategy(config: CognitoConfig): AuthStrategy {
  return {
    name: 'cognito',
    authenticate: async ({ headers, payload }) => {
      const identity = await verifyIdToken(config, readCookie(headers, idTokenCookie))

      if (!identity) return { user: null }

      const user = await findCognitoUser(payload, identity.sub)

      if (!user) return { user: null }

      return {
        user: {
          ...user,
          collection: 'users',
          _strategy: 'cognito',
        },
      }
    },
  }
}
