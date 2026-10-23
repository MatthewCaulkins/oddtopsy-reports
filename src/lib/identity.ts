import type { Payload } from 'payload'

import type { User } from '@/payload-types'
import { getAuthConfig, type CognitoConfig } from '@/lib/auth/config'
import { createInvitedCognitoUser, resendCognitoInvite } from '@/lib/auth/cognitoAdmin'
import { sendAccountInvite, siteURL } from '@/lib/notifications'

/*
 * Where approved staff get their sign-in. Approval decides *who*
 * gets an account (Payload); the identity provider handles *how*
 * they sign in.
 *
 * - 'payload' (local development): a set-password invite using
 *   Payload's own password login.
 * - 'cognito' (production): create the Cognito user, store its sub on
 *   the User, and let Cognito send the invitation (with a temporary
 *   password; Cognito then enforces email MFA). Linking only ever uses
 *   the sub returned by our own AdminCreateUser call, never an email
 *   match.
 *
 * invite() must be safe to call again for the same user; callers
 * record each attempt on the access request.
 */
export type IdentityProvider = {
  name: string
  invite: (payload: Payload, user: User) => Promise<void>
}

export const inviteValidityDays = 7

const payloadPasswordProvider: IdentityProvider = {
  name: 'payload',
  async invite(payload, user) {
    const expiration = inviteValidityDays * 24 * 60 * 60 * 1000

    // Issues a fresh set-password token each time, replacing any earlier one.
    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      disableEmail: true,
      expiration,
    })

    if (!token) {
      throw new Error('Could not issue a set-password token.')
    }

    await sendAccountInvite(
      payload,
      user,
      `${siteURL}/reset-password?token=${encodeURIComponent(token)}&invite=1`,
      new Date(Date.now() + expiration),
    )
  },
}

const cognitoProvider = (config: CognitoConfig): IdentityProvider => ({
  name: 'cognito',
  async invite(payload, user) {
    // Already linked: this is a resend. Cognito re-sends its invitation.
    if (user.cognitoSub) {
      await resendCognitoInvite(config, user.email)
      return
    }

    const sub = await createInvitedCognitoUser(config, user.email)

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { cognitoSub: sub },
      depth: 0,
      overrideAccess: true,
    })
  },
})

/*
 * Cognito when AUTH_PROVIDERS includes it (production), otherwise
 * Payload's own set-password invite (local development).
 */
export function getIdentityProvider(): IdentityProvider {
  const { cognito } = getAuthConfig()

  return cognito ? cognitoProvider(cognito) : payloadPasswordProvider
}
