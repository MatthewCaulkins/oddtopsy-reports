import { headers as getHeaders } from 'next/headers'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { NavLinks } from './NavLinks'

function getInitials(email?: string | null) {
  if (!email) return 'U'

  return email
    .split('@')[0]
    .split(/[.\-_]/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export async function Header() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-logo">
          <img src="/branding/icon.png" alt="Oddtopsy Reports" width={42} height={42} />
        </a>

        <nav className="site-nav">
          <NavLinks />

          {user ? (
            <details className="user-menu">
              <summary>{getInitials(user.email)}</summary>
              <div className="user-menu-panel">
                <a href="/admin">Admin Panel</a>
                <a href="/logout">Logout</a>
              </div>
            </details>
          ) : (
            <a href="/login" className="nav-login">
              Login
            </a>
          )}
        </nav>
      </div>
    </header>
  )
}
