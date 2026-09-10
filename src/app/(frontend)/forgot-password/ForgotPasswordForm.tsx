'use client'

import { useState } from 'react'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [submitted, setSubmitted] = useState(false)

  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      })

      /*
       * Always show the same success message.
       * We don't want to reveal whether an email
       * address exists in the system.
       */
      if (!response.ok) {
        console.error('Forgot password request failed.')
      }

      setSubmitted(true)
    } catch (err) {
      console.error(err)

      setError('We could not process the request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="form-message">
        <h2>Check your email</h2>

        <p>If an account exists for that email address, a password reset link has been sent.</p>

        <a className="button secondary" href="/login">
          Return to Login
        </a>
      </div>
    )
  }

  return (
    <form className="submit-form auth-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="email">Email address</label>

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

      {error && <p className="form-error">{error}</p>}

      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send Reset Link'}
      </button>
    </form>
  )
}
