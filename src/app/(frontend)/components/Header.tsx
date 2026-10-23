import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { NavLinks } from './NavLinks'
import { LogoutButton } from '@/components/LogoutButton'
import { hasRole } from '@/access/roles'
import { getAuthConfig } from '@/lib/auth/config'

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

  const canUseEditorial = hasRole(user, 'editor')

  const isAdmin = hasRole(user, 'admin')

  const { password } = getAuthConfig()
  const signInHref = password ? '/login' : '/auth/login?next=/editorial'

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-logo" aria-label="Oddtopsy Reports" />

        <nav className="site-nav">
          <NavLinks />

          {user ? (
            <details className="user-menu">
              <summary>{getInitials(user.email)}</summary>

              <div className="user-menu-panel">
                {canUseEditorial && <a href="/editorial">Editorial</a>}

                {isAdmin && <a href="/admin">Admin Panel</a>}

                <LogoutButton className="user-menu-logout" />
              </div>
            </details>
          ) : (
            <>
              {/* Cognito-only: straight to Cognito's sign-in page. */}
              <a href={signInHref} className="nav-login">
                {password ? 'Login' : 'Sign In'}
              </a>

              <a href="/request-access" className="nav-login nav-request-access">
                Request Access
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
