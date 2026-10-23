'use client'

import { useState } from 'react'

/*
 * Logging out must be a POST. A plain link to a logout URL gets
 * prefetched by Next.js, which silently signed users out whenever
 * the menu containing it was rendered.
 */
export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)

    let next = '/'

    try {
      // Ends a password session, if any.
      await fetch('/api/users/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => undefined)

      // Ends a Cognito session, if any, and returns where to go next.
      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data = (await response.json()) as { redirect?: string }
        next = data.redirect || '/'
      }
    } finally {
      window.location.href = next
    }
  }

  return (
    <button className={className} type="button" onClick={logout} disabled={pending}>
      {pending ? 'Logging out…' : 'Logout'}
    </button>
  )
}
