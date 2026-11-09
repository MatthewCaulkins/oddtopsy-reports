import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SmsMfaView } from '@/lib/smsMfa'

/*
 * The MFA Agreement form in the browser: defaults, button rules, and
 * the status shown only from what the server returns.
 */

const actions = vi.hoisted(() => ({
  startSmsEnrollment: vi.fn(),
  confirmSmsEnrollment: vi.fn(),
  resendSmsCode: vi.fn(),
  cancelSmsEnrollment: vi.fn(),
  disableSmsMfa: vi.fn(),
}))

vi.mock('@/app/(frontend)/editorial/account/security/actions', () => actions)

const { SmsMfaManager, smsConsentText } = await import('@/app/(frontend)/editorial/account/security/SmsMfaManager')

function view(overrides: Partial<SmsMfaView> = {}): SmsMfaView {
  return {
    status: 'disabled',
    detail: null,
    phoneHint: '',
    consentedAt: null,
    pendingDestination: null,
    pendingVerified: false,
    cognitoChecked: true,
    stepUpExpiresAt: Date.now() + 5 * 60 * 1000,
    email: 'editor@example.com',
    ...overrides,
  }
}

function show(initialView: SmsMfaView) {
  return render(createElement(SmsMfaManager, { initialView, reauthError: null }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MFA Agreement form', () => {
  it('starts with both boxes unchecked and the button disabled', () => {
    show(view())

    expect(screen.getByRole('heading', { name: 'SMS Multifactor Authentication' })).toBeTruthy()
    expect(screen.getByText(/Editors may optionally receive one-time verification codes/)).toBeTruthy()

    const [consent, terms] = screen.getAllByRole('checkbox') as HTMLInputElement[]

    expect(consent.checked).toBe(false)
    expect(terms.checked).toBe(false)
    expect(screen.getByText(smsConsentText)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Terms and Conditions' }).getAttribute('href')).toBe('https://oddtopsies.org/terms')
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('https://oddtopsies.org/privacy')
    expect((screen.getByRole('button', { name: 'Enable SMS Verification' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('needs a valid number and both boxes, separately', () => {
    show(view())

    const button = screen.getByRole('button', { name: 'Enable SMS Verification' }) as HTMLButtonElement
    const phone = screen.getByLabelText('Mobile number')
    const [consent, terms] = screen.getAllByRole('checkbox')

    fireEvent.change(phone, { target: { value: '205 555 0123' } })
    fireEvent.click(consent)
    fireEvent.click(terms)
    expect(button.disabled).toBe(true)

    fireEvent.change(phone, { target: { value: '+1 205 555 0123' } })
    expect(button.disabled).toBe(false)

    fireEvent.click(consent)
    expect(button.disabled).toBe(true)

    fireEvent.click(consent)
    fireEvent.click(terms)
    expect(button.disabled).toBe(true)
  })

  it('asks for a fresh sign-in before changes are possible', () => {
    show(view({ stepUpExpiresAt: null }))

    expect(screen.getByRole('link', { name: 'Sign in again' }).getAttribute('href')).toBe(
      '/auth/login?reauth=1&next=%2Feditorial%2Faccount%2Fsecurity',
    )
    expect((screen.getByRole('button', { name: 'Enable SMS Verification' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows success only after the server confirms, and confirms before disabling', async () => {
    actions.disableSmsMfa.mockResolvedValue({ ok: true, message: 'SMS verification is off.', view: view() })

    show(view({ status: 'enabled', phoneHint: 'ending in 0123' }))

    expect(screen.getByTestId('sms-mfa-status').textContent).toMatch(/ending in 0123/)

    fireEvent.click(screen.getByRole('button', { name: 'Disable SMS Verification' }))
    expect(actions.disableSmsMfa).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Yes, disable SMS verification' }))

    expect(await screen.findByText('SMS verification is off.')).toBeTruthy()
    expect(actions.disableSmsMfa).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('sms-mfa-status').textContent).toMatch(/sent by email/)
  })

  it('keeps the enrolled status when disabling fails', async () => {
    actions.disableSmsMfa.mockResolvedValue({
      ok: false,
      error: 'Too many attempts.',
      view: view({ status: 'enabled', phoneHint: 'ending in 0123' }),
    })

    show(view({ status: 'enabled', phoneHint: 'ending in 0123' }))

    fireEvent.click(screen.getByRole('button', { name: 'Disable SMS Verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, disable SMS verification' }))

    expect(await screen.findByText('Too many attempts.')).toBeTruthy()
    expect(screen.getByTestId('sms-mfa-status').textContent).toMatch(/ending in 0123/)
  })

  it('moves to code entry when the server says a code was sent', async () => {
    actions.startSmsEnrollment.mockResolvedValue({
      ok: true,
      message: 'We sent a verification code.',
      view: view({ status: 'pending', pendingDestination: '+*******0123' }),
    })

    show(view())

    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '+12055550123' } })
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box)
    fireEvent.click(screen.getByRole('button', { name: 'Enable SMS Verification' }))

    expect(await screen.findByLabelText('Verification code')).toBeTruthy()
    expect(actions.startSmsEnrollment).toHaveBeenCalledTimes(1)

    const data = actions.startSmsEnrollment.mock.calls[0][0] as FormData
    expect(Object.fromEntries(data)).toEqual({ phoneNumber: '+12055550123', smsConsent: 'yes', termsAccepted: 'yes' })
  })
})
