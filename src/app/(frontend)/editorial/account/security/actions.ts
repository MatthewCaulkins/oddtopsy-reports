'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { after } from 'next/server'

import { getAuthConfig } from '@/lib/auth/config'
import {
  confirmPhoneVerification,
  describeCognitoError,
  getOwnMfaState,
  isReauthError,
  mfaAccessCookie,
  mfaCookiePath,
  preferEmailMfa,
  preferSmsMfa,
  recentAuthSeconds,
  removePhoneNumber,
  resendPhoneVerification,
  sendPhoneVerification,
  smsEnrollmentCookie,
  verifyStepUpToken,
  type CognitoMfaState,
} from '@/lib/auth/cognitoMfa'
import { notifyUserOfSmsMfaChange } from '@/lib/notifications'
import { consumeRateLimit } from '@/lib/rateLimit'
import { requireRole } from '@/lib/requireRole'
import {
  buildSmsMfaView,
  clearedAgreement,
  createEnrollmentValue,
  readEnrollment,
  type SmsEnrollment,
  type SmsMfaView,
} from '@/lib/smsMfa'
import { normalizePhoneNumber, phoneNumberHint } from '@/lib/validation'
import { signedCookieOptions } from '@/lib/signedCookies'

/*
 * SMS MFA for the signed-in editor, and only for them: who they are
 * comes from the session (Payload) and the step-up token (Cognito),
 * which must belong to the same person. Nothing here takes a user ID,
 * a timestamp or a verification status from the browser.
 *
 * Order of operations: Cognito first, Payload only after Cognito
 * confirms. Every result carries the freshly computed status, so the
 * page shows what is actually true, including after a partial failure.
 */

const pagePath = '/editorial/account/security'

// Code sends per user, on top of Cognito's own limits.
const codeSendLimit = 5
const codeSendWindowMs = 15 * 60 * 1000

export type SmsMfaResult = {
  ok: boolean
  message?: string
  error?: string
  // The step-up sign-in is missing or expired; nothing was changed.
  reauth?: boolean
  view: SmsMfaView
}

const enrollmentCookieOptions = { ...signedCookieOptions, path: mfaCookiePath, maxAge: recentAuthSeconds }

async function begin() {
  const { payload, user } = await requireRole('editor')
  const cognito = getAuthConfig().cognito
  const jar = await cookies()

  const rawToken = jar.get(mfaAccessCookie)?.value
  const stepUp = cognito && user.cognitoSub ? await verifyStepUpToken(cognito, rawToken) : null
  const token = stepUp && stepUp.sub === user.cognitoSub ? rawToken! : null

  let enrollment = readEnrollment(jar.get(smsEnrollmentCookie)?.value, user.cognitoSub)

  const setEnrollment = (value: SmsEnrollment | null) => {
    enrollment = value

    if (value) {
      jar.set(smsEnrollmentCookie, createEnrollmentValue(value), enrollmentCookieOptions)
    } else {
      jar.delete({ name: smsEnrollmentCookie, path: mfaCookiePath })
    }
  }

  // The current status, after whatever this action did.
  const view = async (cognitoState?: CognitoMfaState | null) => {
    const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })

    return buildSmsMfaView({
      payload,
      user: fresh,
      cognito,
      stepUpExpiresAt: token ? stepUp!.expiresAt : null,
      enrollment,
      cognitoState,
    })
  }

  const fail = async (error: string, extra: Partial<SmsMfaResult> = {}, cognitoState?: CognitoMfaState | null) => ({
    ok: false,
    error,
    ...extra,
    view: await view(cognitoState),
  })

  return { payload, user, cognito, token, getEnrollment: () => enrollment, setEnrollment, view, fail }
}

type Context = Awaited<ReturnType<typeof begin>>

function logFailure(context: Context, event: string, error: unknown) {
  // The error's name only: Cognito messages can echo the phone number.
  context.payload.logger.error(
    { event, userID: context.user.id, error: error instanceof Error ? error.name : 'error' },
    'SMS MFA change failed',
  )
}

async function cognitoFailure(context: Context, event: string, error: unknown) {
  logFailure(context, event, error)

  return context.fail(describeCognitoError(error), isReauthError(error) ? { reauth: true } : {})
}

function reauthRequired(context: Context) {
  return context.fail('For your security, sign in again to confirm it’s you before changing MFA settings.', {
    reauth: true,
  })
}

async function run(action: (context: Context) => Promise<SmsMfaResult>): Promise<SmsMfaResult> {
  const context = await begin()

  try {
    if (!context.cognito || !context.user.cognitoSub) {
      return await context.fail('SMS verification is not available for this account.')
    }

    const result = await action(context)

    revalidatePath(pagePath)

    return result
  } catch (error) {
    // Let Next's own control flow (e.g. a sign-in redirect) through.
    unstable_rethrow(error)
    logFailure(context, 'sms_mfa.error', error)

    return context.fail('Something went wrong. Reload the page to see the current status.')
  }
}

/*
 * Step 1: validate the form, put the number on the Cognito account and
 * have Cognito text it a code. Nothing is saved in Payload yet.
 */
export async function startSmsEnrollment(formData: FormData): Promise<SmsMfaResult> {
  return run(async (context) => {
    const { cognito, token, user, payload } = context

    if (!token) return reauthRequired(context)

    if (user.smsMfaEnabled) {
      return context.fail('SMS verification is already on. To use a different number, turn it off first.')
    }

    const phoneNumber = normalizePhoneNumber(formData.get('phoneNumber'))

    if (!phoneNumber) {
      return context.fail('Enter a mobile number in international format, starting with + and the country code.')
    }

    if (formData.get('smsConsent') !== 'yes') {
      return context.fail('Check the box to consent to receiving verification codes by text message.')
    }

    if (formData.get('termsAccepted') !== 'yes') {
      return context.fail('Check the box to agree to the Terms and Conditions and Privacy Policy.')
    }

    if (!consumeRateLimit(`sms-mfa-code:${user.id}`, codeSendLimit, codeSendWindowMs)) {
      return context.fail('Too many codes requested. Wait 15 minutes and try again.')
    }

    let state: CognitoMfaState

    try {
      state = await getOwnMfaState(cognito!, token)
    } catch (error) {
      return cognitoFailure(context, 'sms_mfa.state_failed', error)
    }

    if (state.smsEnabled) {
      return context.fail('SMS verification is already active on your sign-in account. Turn it off before setting it up again.', {}, state)
    }

    let destination: string | null

    try {
      destination = await sendPhoneVerification(cognito!, token, phoneNumber)
    } catch (error) {
      // Don't leave the unconfirmed number we just set on the account (SMS MFA is off, so this is safe).
      await getOwnMfaState(cognito!, token)
        .then((current) =>
          current.phoneNumber === phoneNumber && !current.phoneVerified ? removePhoneNumber(cognito!, token) : undefined,
        )
        .catch(() => undefined)

      return cognitoFailure(context, 'sms_mfa.code_failed', error)
    }

    context.setEnrollment({
      sub: user.cognitoSub!,
      phoneNumber,
      consentedAt: new Date().toISOString(),
      destination,
      verified: false,
    })

    payload.logger.info({ event: 'sms_mfa.code_sent', userID: user.id }, 'SMS verification code sent')

    return {
      ok: true,
      message: `We sent a verification code to ${destination || phoneNumberHint(phoneNumber)}. Enter it below to finish.`,
      view: await context.view(),
    }
  })
}

/*
 * Step 2: check the code with Cognito, turn on SMS MFA (email stays on
 * as the backup), confirm the result with Cognito, and only then save
 * the agreement. Safe to retry: a step that already happened in this
 * enrollment is not repeated.
 */
export async function confirmSmsEnrollment(code: string): Promise<SmsMfaResult> {
  return run(async (context) => {
    const { cognito, token, user, payload } = context
    const enrollment = context.getEnrollment()

    if (!token) return reauthRequired(context)

    if (!enrollment) {
      return context.fail('This setup has expired. Start again to get a new code.')
    }

    if (user.smsMfaEnabled) {
      context.setEnrollment(null)
      return { ok: true, message: 'SMS verification is on.', view: await context.view() }
    }

    try {
      const state = await getOwnMfaState(cognito!, token)

      if (state.phoneNumber !== enrollment.phoneNumber) {
        context.setEnrollment(null)

        return context.fail('The phone number on your sign-in account changed during setup. Start again.', {}, state)
      }

      if (!enrollment.verified) {
        const trimmed = String(code || '').trim()

        if (!/^\d{6}$/.test(trimmed)) {
          return context.fail('Enter the 6-digit code from the text message.')
        }

        await confirmPhoneVerification(cognito!, token, trimmed)
        context.setEnrollment({ ...enrollment, verified: true })
      }

      if (!state.smsEnabled || state.preferred !== 'SMS_MFA' || !state.emailEnabled) {
        await preferSmsMfa(cognito!, token)
      }

      const confirmed = await getOwnMfaState(cognito!, token)

      if (
        !confirmed.smsEnabled ||
        !confirmed.phoneVerified ||
        !confirmed.emailEnabled ||
        confirmed.phoneNumber !== enrollment.phoneNumber
      ) {
        logFailure(context, 'sms_mfa.not_confirmed', new Error('CognitoStateMismatch'))

        return context.fail('Cognito did not confirm SMS verification, so nothing was saved. Try again.', {}, confirmed)
      }

      try {
        await payload.update({
          collection: 'users',
          id: user.id,
          data: {
            smsMfaEnabled: true,
            smsMfaPhoneNumber: enrollment.phoneNumber,
            smsMfaConsentedAt: enrollment.consentedAt,
            smsMfaTermsAccepted: true,
          },
          depth: 0,
          overrideAccess: true,
        })
      } catch (error) {
        // Cognito is on; keep the verified enrollment so "Finish setup" can save it.
        logFailure(context, 'sms_mfa.save_failed', error)

        return context.fail(
          'SMS verification is active on your sign-in account, but your agreement could not be saved. Select Finish setup to try again.',
          {},
          confirmed,
        )
      }

      context.setEnrollment(null)
      payload.logger.info({ event: 'sms_mfa.enabled', userID: user.id }, 'SMS MFA enabled')

      const hint = phoneNumberHint(enrollment.phoneNumber)
      after(() => notifyUserOfSmsMfaChange(payload, user, 'enabled', hint))

      return {
        ok: true,
        message: `SMS verification is on. Sign-in codes will be sent to your phone number ${hint}.`,
        view: await context.view(confirmed),
      }
    } catch (error) {
      return cognitoFailure(context, 'sms_mfa.verify_failed', error)
    }
  })
}

export async function resendSmsCode(): Promise<SmsMfaResult> {
  return run(async (context) => {
    const { cognito, token, user } = context
    const enrollment = context.getEnrollment()

    if (!token) return reauthRequired(context)

    if (!enrollment || enrollment.verified) {
      return context.fail('There is no code waiting to be entered. Start again.')
    }

    if (!consumeRateLimit(`sms-mfa-code:${user.id}`, codeSendLimit, codeSendWindowMs)) {
      return context.fail('Too many codes requested. Wait 15 minutes and try again.')
    }

    try {
      const destination = await resendPhoneVerification(cognito!, token)

      context.setEnrollment({ ...enrollment, destination: destination || enrollment.destination })

      return { ok: true, message: `A new code was sent to ${destination || 'your phone'}.`, view: await context.view() }
    } catch (error) {
      return cognitoFailure(context, 'sms_mfa.code_failed', error)
    }
  })
}

/*
 * Abandons a setup that has not been turned on. The unconfirmed number
 * is removed from Cognito when possible (it is harmless if it stays:
 * it is unverified and SMS MFA is off).
 */
export async function cancelSmsEnrollment(): Promise<SmsMfaResult> {
  return run(async (context) => {
    const { cognito, token, user } = context
    const enrollment = context.getEnrollment()

    context.setEnrollment(null)

    if (token && enrollment && !user.smsMfaEnabled) {
      try {
        const state = await getOwnMfaState(cognito!, token)

        if (!state.smsEnabled && state.phoneNumber === enrollment.phoneNumber) {
          await removePhoneNumber(cognito!, token)
        }
      } catch (error) {
        logFailure(context, 'sms_mfa.cancel_cleanup_failed', error)
      }
    }

    return { ok: true, message: 'Setup cancelled. Sign-in codes are still sent by email.', view: await context.view() }
  })
}

/*
 * Back to email: one Cognito call turns SMS off and makes email the
 * preferred method, then the number is removed from Cognito (so it no
 * longer works for account recovery). Cognito's result is checked
 * before the agreement is cleared in Payload.
 */
export async function disableSmsMfa(): Promise<SmsMfaResult> {
  return run(async (context) => {
    const { cognito, token, user, payload } = context

    if (!token) return reauthRequired(context)

    let confirmed: CognitoMfaState
    let numberRemoved = true

    try {
      const state = await getOwnMfaState(cognito!, token)

      if (state.smsEnabled || state.preferred === 'SMS_MFA' || !state.emailEnabled) {
        await preferEmailMfa(cognito!, token)
      }

      if (state.phoneNumber) {
        try {
          await removePhoneNumber(cognito!, token)
        } catch (error) {
          numberRemoved = false
          logFailure(context, 'sms_mfa.remove_number_failed', error)
        }
      }

      confirmed = await getOwnMfaState(cognito!, token)
    } catch (error) {
      return cognitoFailure(context, 'sms_mfa.disable_failed', error)
    }

    if (confirmed.smsEnabled || !confirmed.emailEnabled) {
      logFailure(context, 'sms_mfa.disable_not_confirmed', new Error('CognitoStateMismatch'))

      return context.fail('Cognito did not confirm the change, so SMS verification may still be on. Try again.', {}, confirmed)
    }

    const hint = phoneNumberHint(user.smsMfaPhoneNumber)
    const hadAgreement = Boolean(user.smsMfaEnabled)

    try {
      await payload.update({ collection: 'users', id: user.id, data: clearedAgreement, depth: 0, overrideAccess: true })
    } catch (error) {
      logFailure(context, 'sms_mfa.clear_failed', error)

      return context.fail(
        'SMS verification is off and sign-in codes now go to your email, but your agreement record could not be cleared. Reload the page to finish.',
        {},
        confirmed,
      )
    }

    context.setEnrollment(null)
    payload.logger.info({ event: 'sms_mfa.disabled', userID: user.id }, 'SMS MFA disabled')

    if (hadAgreement) after(() => notifyUserOfSmsMfaChange(payload, user, 'disabled', hint))

    return {
      ok: true,
      message: numberRemoved
        ? `SMS verification is off. Sign-in codes will be sent to ${user.email}.`
        : `SMS verification is off and sign-in codes will be sent to ${user.email}. Your phone number could not be removed from your sign-in account; ask an administrator to remove it, or it will be replaced if you set up SMS again.`,
      view: await context.view(confirmed),
    }
  })
}
