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

    try {
      await fetch('/api/users/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      window.location.href = '/'
    }
  }

  return (
    <button className={className} type="button" onClick={logout} disabled={pending}>
      {pending ? 'Logging out…' : 'Logout'}
    </button>
  )
}
