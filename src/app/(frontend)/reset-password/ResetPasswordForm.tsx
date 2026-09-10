'use client'

import { useState } from 'react'

type Props = {
  token: string
}

export function ResetPasswordForm({ token }: Props) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [complete, setComplete] = useState(false)

  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      })

      if (!response.ok) {
        setError('This reset link is invalid or has expired.')
        return
      }

      setComplete(true)
    } catch (err) {
      console.error(err)

      setError('We could not reset your password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (complete) {
    return (
      <div className="form-message">
        <h2>Password updated</h2>

        <p>Your password has been changed successfully.</p>

        <a className="button primary" href="/login">
          Sign In
        </a>
      </div>
    )
  }

  return (
    <form className="submit-form auth-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="password">New password</label>

        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="confirmPassword">Confirm password</label>

        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Updating…' : 'Reset Password'}
      </button>
    </form>
  )
}
