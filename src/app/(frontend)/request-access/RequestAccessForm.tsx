'use client'

import { useActionState } from 'react'

import { requestAccess, type RequestAccessState } from './actions'

const initialState: RequestAccessState = {}

export function RequestAccessForm({ formToken }: { formToken: string }) {
  const [state, action, pending] = useActionState(requestAccess, initialState)

  if (state.submitted) {
    return (
      <div className="empty-state">
        <h2>Request received</h2>

        <p>
          Thank you. The editorial team will review your request. If it is approved, you will
          receive an email with instructions to set up your account.
        </p>

        <a href="/" className="button secondary">
          Return home
        </a>
      </div>
    )
  }

  return (
    <form className="submit-form auth-form" action={action}>
      <input type="hidden" name="formToken" value={formToken} />

      {/* Left empty by people; bots that fill every field reveal themselves. */}
      <div className="form-honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="form-row">
        <label htmlFor="name">Name</label>

        <input id="name" name="name" type="text" autoComplete="name" maxLength={200} required />
      </div>

      <div className="form-row">
        <label htmlFor="email">Email</label>

        <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
      </div>

      <div className="form-row">
        <label htmlFor="affiliation">Affiliation</label>

        <input
          id="affiliation"
          name="affiliation"
          type="text"
          autoComplete="organization"
          maxLength={300}
          required
        />
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Submitting…' : 'Request Access'}
      </button>
    </form>
  )
}
