'use client'

import { useState } from 'react'

export function LoginForm() {
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const form = new FormData(event.currentTarget)

    const res = await fetch('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    })

    if (!res.ok) {
      setError('Invalid email or password.')
      return
    }

    window.location.href = '/'
  }

  return (
    <form className="submit-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input name="email" type="email" required />
      </label>

      <label>
        Password
        <input name="password" type="password" required />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="login-buttons">
        <button className="button primary" type="submit">
          Login
        </button>
        <a className="button secondary" href="/forgot-password">
          Forgot Password
        </a>
        <a className="button secondary" href="/signup">
          Signup
        </a>
      </div>
    </form>
  )
}
