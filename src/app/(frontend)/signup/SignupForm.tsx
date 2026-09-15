'use client'

import { useActionState, useState } from 'react'

import { signup, type SignupState } from './actions'

const initialState: SignupState = {}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, initialState)

  const [displayName, setDisplayName] = useState('')

  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')

  const [confirmPassword, setConfirmPassword] = useState('')

  if (state.success) {
    return (
      <div className="empty-state">
        <h2>Account request received</h2>

        <p>Your account is awaiting approval from an Oddtopsy Reports administrator.</p>

        <p>You will not be able to sign in until your account has been approved.</p>

        <a href="/login" className="button secondary">
          Return to Login
        </a>
      </div>
    )
  }

  return (
    <form className="submit-form auth-form" action={action}>
      <div className="form-row">
        <label htmlFor="displayName">Name</label>

        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="email">Email</label>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="password">Password</label>

        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="confirmPassword">Confirm Password</label>

        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Submitting…' : 'Request Account'}
      </button>
    </form>
  )
}
