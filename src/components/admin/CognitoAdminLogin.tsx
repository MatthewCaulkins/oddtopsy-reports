import { getAuthConfig } from '@/lib/auth/config'

/*
 * Shown under Payload's admin login form. When Cognito sign-in is
 * enabled, admins can use it to reach /admin; the password form above
 * stays available while password sign-in is enabled.
 */
export default function CognitoAdminLogin() {
  const { password, cognito } = getAuthConfig()

  if (!cognito) return null

  return (
    <div className="cognito-admin-login">
      <a className="btn btn--style-primary btn--size-large" href="/auth/login?next=/admin">
        Sign in with Cognito
      </a>

      {password && <p>The email and password form above is the legacy login.</p>}
    </div>
  )
}
