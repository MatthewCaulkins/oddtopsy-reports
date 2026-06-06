import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'

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
          <span className="site-logo-mark">OR</span>
          <span>
            <strong>Oddtopsy Reports</strong>
            <small>Cadaveric studies & anatomical variations</small>
          </span>
        </a>

        <nav className="site-nav">
          <a href="/articles">Papers</a>
          <a href="/submit">Submit</a>
          <a href="/about">About</a>
          <a href="/subscribe">Subscribe</a>

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
