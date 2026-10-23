import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { NavLinks } from './NavLinks'
import { UserMenuLinks } from './UserMenuLinks'
import { hasRole } from '@/access/roles'
import { getAuthConfig } from '@/lib/auth/config'
import { signInURL } from '@/lib/auth/returnTo'

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

  // After signing in, staff land on the home page and can choose Editorial from the menu.
  const { password } = getAuthConfig()
  const signInHref = signInURL('/')

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-logo" aria-label="Oddtopsy Reports" />

        <nav className="site-nav">
          <NavLinks />

          {user ? (
            <details className="user-menu">
              <summary>{getInitials(user.email)}</summary>

              <UserMenuLinks canUseEditorial={canUseEditorial} isAdmin={isAdmin} />
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
