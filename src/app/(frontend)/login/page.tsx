import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { LoginForm } from './LoginForm'

import { redirect } from 'next/navigation'

import { getAuthConfig } from '@/lib/auth/config'
import { safeNextPath } from '@/lib/auth/cognito'

type Props = {
  searchParams: Promise<{
    error?: string
    next?: string
  }>
}

const errorMessages: Record<string, string> = {
  not_authorized:
    'That account does not have editorial access yet. If your request was approved, use the sign-in link from your invitation email.',
  signin_failed: 'Sign-in did not complete. Please try again.',
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, next: rawNext } = await searchParams
  // Back to the protected page that sent them here, otherwise home.
  const next = safeNextPath(rawNext)
  const cognitoSignIn = `/auth/login?next=${encodeURIComponent(next)}`
  const { password, cognito } = getAuthConfig()

  // Cognito-only: nothing to choose here, so go straight to Cognito
  // (unless we are showing why the last sign-in didn't work).
  if (!password && !error) redirect(cognitoSignIn)

  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        {/* <p className="eyebrow">Editor login</p> */}
        <h1>Sign in to review submissions.</h1>

        {error && errorMessages[error] && <p className="form-error">{errorMessages[error]}</p>}

        {cognito && (
          <div className="login-buttons">
            <a className="button primary" href={cognitoSignIn}>
              Sign In
            </a>
            <a className="button secondary" href="/request-access">
              Request Access
            </a>
          </div>
        )}

        {password &&
          (cognito ? (
            // Transition only: remove with AUTH_PROVIDERS=cognito.
            <details className="legacy-login">
              <summary>Legacy login (email and password)</summary>
              <LoginForm next={next} />
            </details>
          ) : (
            <LoginForm next={next} />
          ))}
      </section>
      <Footer />
    </main>
  )
}
