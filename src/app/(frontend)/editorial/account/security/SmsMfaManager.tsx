'use client'

import { useState, useTransition, type FormEvent } from 'react'

import type { SmsMfaView } from '@/lib/smsMfa'
import { normalizePhoneNumber } from '@/lib/validation'

import {
  cancelSmsEnrollment,
  confirmSmsEnrollment,
  disableSmsMfa,
  resendSmsCode,
  startSmsEnrollment,
  type SmsMfaResult,
} from './actions'

type Props = {
  initialView: SmsMfaView
  reauthError: string | null
}

const reauthURL = `/auth/login?reauth=1&next=${encodeURIComponent('/editorial/account/security')}`

export const smsConsentText =
  'By checking this box, I consent to receive one-time passcodes and verification codes from Oddtopsy Reports by SMS. Message frequency varies. Message and data rates may apply. Reply HELP for assistance or STOP to opt out.'

function formatDateTime(value: string | null) {
  return value
    ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : ''
}

/*
 * The MFA Agreement controls. The status always comes from the server:
 * each action returns the newly computed view, and nothing is shown as
 * done until that action has finished. Buttons are disabled while an
 * action runs, so a double click cannot submit twice.
 */
export function SmsMfaManager({ initialView, reauthError }: Props) {
  const [view, setView] = useState(initialView)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(
    reauthError ? { kind: 'error', text: reauthError } : null,
  )
  const [needsReauth, setNeedsReauth] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [code, setCode] = useState('')
  const [confirmingDisable, setConfirmingDisable] = useState(false)
  const [pending, startTransition] = useTransition()

  const recentlySignedIn =
    !needsReauth && view.stepUpExpiresAt !== null && view.stepUpExpiresAt > Date.now()
  const phoneValid = normalizePhoneNumber(phoneNumber) !== null

  function apply(result: SmsMfaResult) {
    setView(result.view)
    setNeedsReauth(Boolean(result.reauth))
    setMessage(
      result.ok
        ? result.message
          ? { kind: 'success', text: result.message }
          : null
        : { kind: 'error', text: result.error || 'Something went wrong.' },
    )

    return result.ok
  }

  function act(action: () => Promise<SmsMfaResult>, onSuccess?: () => void) {
    if (pending) return

    setMessage(null)

    startTransition(async () => {
      try {
        if (apply(await action())) onSuccess?.()
      } catch {
        setMessage({
          kind: 'error',
          text: 'The request did not complete. Reload the page to see the current status.',
        })
      }
    })
  }

  function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const data = new FormData(event.currentTarget)

    act(
      () => startSmsEnrollment(data),
      () => setCode(''),
    )
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    act(
      () => confirmSmsEnrollment(code),
      () => {
        setCode('')
        setPhoneNumber('')
        setSmsConsent(false)
        setTermsAccepted(false)
      },
    )
  }

  const reauthNotice = (
    <div className="sms-mfa-reauth" role="note">
      <p>For your security, confirm it’s you by signing in again before changing MFA settings.</p>
      <a className="button secondary" href={reauthURL}>
        Sign in again
      </a>
    </div>
  )

  const statusLine = {
    unavailable: 'Not available',
    disabled: 'Off: sign-in codes are sent by email',
    pending: 'Setup in progress: waiting for the code from your text message',
    enabled: `On: sign-in codes are sent by text message to your phone number ${view.phoneHint}`,
    needs_attention: 'Needs attention',
  }[view.status]

  return (
    <div className="sms-mfa">
      <div className="section-heading section-heading-rule">
        <h2>SMS Multifactor Authentication</h2>
      </div>

      <div className="editorial-dashboard-summary">
        <p>
          Editors may optionally receive one-time verification codes by text message instead of
          email when signing in to Oddtopsy Reports.
        </p>

        <dl className="sms-mfa-status" aria-live="polite">
          <dt>Status</dt>
          <dd data-testid="sms-mfa-status">{statusLine}</dd>

          {view.status === 'enabled' && view.consentedAt && (
            <>
              <dt>Agreed</dt>
              <dd>{formatDateTime(view.consentedAt)}</dd>
            </>
          )}

          {view.status !== 'unavailable' && (
            <>
              <dt>Email codes</dt>
              <dd>
                {view.status === 'enabled' ? 'Available as a backup at ' : 'Sent to '}
                {view.email}
              </dd>
            </>
          )}
        </dl>

        {view.detail && (
          <p
            className={view.status === 'needs_attention' ? 'form-error' : 'editorial-toolbar-hint'}
            role="status"
          >
            {view.detail}
          </p>
        )}

        {view.status !== 'unavailable' && !view.cognitoChecked && (
          <p className="editorial-toolbar-hint">
            The current setting could not be confirmed with Cognito just now; this status is from
            the last saved agreement.
          </p>
        )}

        {message && (
          <p className={message.kind === 'error' ? 'form-error' : 'form-success'} role="status">
            {message.text}
          </p>
        )}

        {view.status !== 'unavailable' &&
          !recentlySignedIn &&
          view.status !== 'pending' &&
          reauthNotice}

        {view.status === 'disabled' && (
          <form className="submit-form sms-mfa-form" onSubmit={enroll} noValidate>
            <div className="form-row">
              <label htmlFor="sms-mfa-phone">Mobile number</label>
              <div>
                <input
                  id="sms-mfa-phone"
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+1 205 555 0123"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  aria-describedby="sms-mfa-phone-hint"
                  aria-invalid={phoneNumber !== '' && !phoneValid}
                  disabled={pending}
                />
                <p id="sms-mfa-phone-hint" className="editorial-toolbar-hint">
                  Needed only if you turn on SMS. Use international format: + then the country code
                  and number.
                </p>
              </div>
            </div>

            <label className="sms-mfa-check">
              <input
                type="checkbox"
                name="smsConsent"
                value="yes"
                checked={smsConsent}
                onChange={(event) => setSmsConsent(event.target.checked)}
                disabled={pending}
              />
              <span>{smsConsentText}</span>
            </label>

            <label className="sms-mfa-check">
              <input
                type="checkbox"
                name="termsAccepted"
                value="yes"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                disabled={pending}
              />
              <span>
                I have read and agree to the{' '}
                <a
                  className="page-link"
                  href="https://oddtopsies.org/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  Terms and Conditions
                </a>{' '}
                and{' '}
                <a
                  className="page-link"
                  href="https://oddtopsies.org/privacy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>

            <button
              className="button primary"
              type="submit"
              disabled={
                pending || !recentlySignedIn || !phoneValid || !smsConsent || !termsAccepted
              }
            >
              {pending ? 'Sending code…' : 'Enable SMS Verification'}
            </button>
          </form>
        )}

        {view.status === 'pending' && (
          <div className="sms-mfa-pending">
            {!recentlySignedIn ? (
              reauthNotice
            ) : view.pendingVerified ? (
              <p>Your number is verified. Finish setup to turn on SMS verification.</p>
            ) : (
              <p>
                Enter the 6-digit code we sent to {view.pendingDestination || 'your phone'}. SMS
                verification stays off until the code is confirmed.
              </p>
            )}

            <form className="sms-mfa-code" onSubmit={verify}>
              {!view.pendingVerified && (
                <label>
                  Verification code
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    disabled={pending || !recentlySignedIn}
                  />
                </label>
              )}

              <div className="editorial-user-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={
                    pending || !recentlySignedIn || (!view.pendingVerified && code.length !== 6)
                  }
                >
                  {pending
                    ? 'Checking…'
                    : view.pendingVerified
                      ? 'Finish setup'
                      : 'Verify and Enable'}
                </button>

                {!view.pendingVerified && (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => act(resendSmsCode)}
                    disabled={pending || !recentlySignedIn}
                  >
                    Send a new code
                  </button>
                )}

                <button
                  className="button secondary"
                  type="button"
                  onClick={() => act(cancelSmsEnrollment)}
                  disabled={pending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {view.status === 'needs_attention' && view.pendingVerified && (
          <div className="editorial-user-actions">
            <button
              className="button primary"
              type="button"
              onClick={() => act(() => confirmSmsEnrollment(''))}
              disabled={pending || !recentlySignedIn}
            >
              {pending ? 'Saving…' : 'Finish setup'}
            </button>
          </div>
        )}

        {(view.status === 'enabled' || view.status === 'needs_attention') && !confirmingDisable && (
          <div className="editorial-user-actions">
            <button
              className="button secondary button-danger"
              type="button"
              onClick={() => {
                setMessage(null)
                setConfirmingDisable(true)
              }}
              disabled={pending || !recentlySignedIn}
            >
              Disable SMS Verification
            </button>
          </div>
        )}

        {confirmingDisable && (view.status === 'enabled' || view.status === 'needs_attention') && (
          <div
            className="editorial-user-delete"
            role="alertdialog"
            aria-label="Disable SMS verification"
          >
            <p>
              <strong>Turn off SMS verification?</strong> Sign-in codes will be sent to {view.email}{' '}
              instead, and your phone number and SMS agreement will be removed.
            </p>

            <div className="editorial-user-actions">
              <button
                className="button primary button-danger"
                type="button"
                onClick={() => act(disableSmsMfa, () => setConfirmingDisable(false))}
                disabled={pending}
              >
                {pending ? 'Turning off…' : 'Yes, disable SMS verification'}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setConfirmingDisable(false)}
                disabled={pending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
