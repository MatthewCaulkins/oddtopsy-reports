import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { ResetPasswordForm } from './ResetPasswordForm'

import { redirect } from 'next/navigation'
import { getAuthConfig } from '@/lib/auth/config'

type Props = {
  searchParams: Promise<{
    token?: string
    invite?: string
  }>
}

// Also serves approved staff's account-setup invite (?invite=1), which uses the same token flow.
export default async function ResetPasswordPage({ searchParams }: Props) {
  // Passwords are managed by Cognito when password sign-in is off.
  if (!getAuthConfig().password) redirect('/login')

  const { token, invite } = await searchParams
  const isInvite = invite === '1'

  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <div className="page-hero-content">
          <h1>{isInvite ? 'Set Up Your Account' : 'Reset Password'}</h1>

          <p>
            {isInvite
              ? 'Your editorial access was approved. Choose a password to finish setting up your Oddtopsy Reports account.'
              : 'Choose a new password for your Oddtopsy Reports account.'}
          </p>
        </div>

        <div className="content-panel">
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="form-message">
              <h2>Invalid reset link</h2>

              <p>This password reset link is missing its token.</p>

              <a className="button secondary" href="/forgot-password">
                Request another link
              </a>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  )
}
