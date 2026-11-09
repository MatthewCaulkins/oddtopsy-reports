import type { Payload } from 'payload'

import type { CognitoConfig } from '@/lib/auth/config'
import { getMfaStateBySub, recentAuthSeconds, type CognitoMfaState } from '@/lib/auth/cognitoMfa'
import { createSignedValue, readSignedValue } from '@/lib/signedCookies'
import { phoneNumberHint } from '@/lib/validation'
import type { User } from '@/payload-types'

/*
 * The SMS MFA agreement on Editorial > MFA Agreement.
 *
 * Cognito decides how someone is challenged at sign-in; the Payload
 * fields record the agreement behind it. The page shows both, and when
 * they disagree it either repairs Payload (only ever towards "off") or
 * says what is wrong and offers the fix. It never claims more than
 * Cognito confirms.
 */

export const clearedAgreement = {
  smsMfaEnabled: false,
  smsMfaPhoneNumber: null,
  smsMfaConsentedAt: null,
  smsMfaTermsAccepted: false,
} as const

/*
 * An enrollment waiting for its text-message code, in a signed,
 * httpOnly cookie (src/lib/signedCookies.ts). The consent time is set
 * by the server when the form is submitted; `verified` records that
 * this enrollment's code was accepted, so a retry after a later failure
 * does not need another code.
 */
export type SmsEnrollment = {
  sub: string
  phoneNumber: string
  consentedAt: string
  destination: string | null
  verified: boolean
}

export function createEnrollmentValue(enrollment: SmsEnrollment) {
  return createSignedValue(enrollment, recentAuthSeconds)
}

export function readEnrollment(value: string | null | undefined, sub: string | null | undefined) {
  const enrollment = readSignedValue<SmsEnrollment>(value)

  return enrollment && sub && enrollment.sub === sub ? enrollment : null
}

export type SmsMfaStatus = 'unavailable' | 'disabled' | 'pending' | 'enabled' | 'needs_attention'

export type SmsMfaView = {
  status: SmsMfaStatus
  // Why the feature is unavailable, or what needs attention.
  detail: string | null
  phoneHint: string
  consentedAt: string | null
  pendingDestination: string | null
  pendingVerified: boolean
  // False when Cognito could not be asked; the status is then Payload's alone.
  cognitoChecked: boolean
  // Until when a recent sign-in allows changes (ms since epoch), or null.
  stepUpExpiresAt: number | null
  email: string
}

type ViewInput = {
  payload: Payload
  user: User
  cognito: CognitoConfig | null
  stepUpExpiresAt: number | null
  enrollment: SmsEnrollment | null
  // A state already read in this request (null: reading it failed); when omitted it is read with AdminGetUser.
  cognitoState?: CognitoMfaState | null
}

export async function buildSmsMfaView({
  payload,
  user,
  cognito,
  stepUpExpiresAt,
  enrollment,
  cognitoState,
}: ViewInput): Promise<SmsMfaView> {
  const base: SmsMfaView = {
    status: 'disabled',
    detail: null,
    phoneHint: user.smsMfaEnabled ? phoneNumberHint(user.smsMfaPhoneNumber) : '',
    consentedAt: user.smsMfaEnabled ? user.smsMfaConsentedAt || null : null,
    pendingDestination: null,
    pendingVerified: false,
    cognitoChecked: false,
    stepUpExpiresAt,
    email: user.email,
  }

  if (!cognito || !user.cognitoSub) {
    return {
      ...base,
      status: 'unavailable',
      detail: cognito
        ? 'Your account is not linked to a Cognito sign-in yet, so SMS verification cannot be set up.'
        : 'SMS verification is available only when signing in with Cognito. This environment uses password sign-in.',
    }
  }

  let state = cognitoState ?? null

  if (cognitoState === undefined) {
    try {
      state = await getMfaStateBySub(cognito, user.cognitoSub)
    } catch (error) {
      payload.logger.warn(
        { event: 'sms_mfa.state_unavailable', userID: user.id, error: error instanceof Error ? error.name : 'error' },
        'Could not read MFA settings from Cognito',
      )
    }
  }

  const view = { ...base, cognitoChecked: Boolean(state) }

  if (user.smsMfaEnabled) {
    if (state && !state.smsEnabled) {
      /*
       * Cognito no longer sends SMS codes (an administrator reset it, or
       * a turn-off finished in Cognito but not here). The agreement only
       * describes a current enrollment, so clear it to match.
       */
      try {
        await payload.update({
          collection: 'users',
          id: user.id,
          data: clearedAgreement,
          depth: 0,
          overrideAccess: true,
        })
      } catch (error) {
        payload.logger.error(
          { event: 'sms_mfa.reconcile_failed', userID: user.id, error: error instanceof Error ? error.name : 'error' },
          'Could not clear an SMS agreement Cognito no longer uses',
        )

        return {
          ...view,
          status: 'needs_attention',
          detail:
            'SMS verification is off on your sign-in account (codes are sent by email), but your saved agreement could not be cleared yet. Reload the page to try again.',
        }
      }

      payload.logger.info({ event: 'sms_mfa.reconciled', userID: user.id }, 'Cleared an SMS agreement Cognito no longer uses')

      return {
        ...view,
        phoneHint: '',
        consentedAt: null,
        detail: 'SMS verification is no longer active on your sign-in account, so your SMS agreement was cleared. Sign-in codes are sent by email.',
      }
    }

    if (state && state.phoneNumber !== user.smsMfaPhoneNumber) {
      return {
        ...view,
        status: 'needs_attention',
        detail:
          'The phone number on your sign-in account no longer matches the number you agreed to. Turn off SMS verification, then set it up again with the right number.',
      }
    }

    return { ...view, status: 'enabled' }
  }

  if (state?.smsEnabled) {
    return {
      ...view,
      status: 'needs_attention',
      pendingVerified: Boolean(enrollment?.verified),
      pendingDestination: enrollment?.destination || null,
      detail: enrollment?.verified
        ? 'Your number is verified and SMS verification is active, but your agreement was not saved. Finish setup to save it, or turn SMS verification off.'
        : 'SMS verification is active on your sign-in account, but no agreement is recorded here. Turn it off, then set it up again if you want it.',
    }
  }

  if (enrollment) {
    return {
      ...view,
      status: 'pending',
      pendingDestination: enrollment.destination,
      pendingVerified: enrollment.verified,
    }
  }

  return view
}
