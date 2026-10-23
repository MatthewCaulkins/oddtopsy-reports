import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { ForgotPasswordForm } from './ForgotPasswordForm'

import { redirect } from 'next/navigation'
import { getAuthConfig } from '@/lib/auth/config'

export default function ForgotPasswordPage() {
  // Passwords are managed by Cognito when password sign-in is off.
  if (!getAuthConfig().password) redirect('/login')

  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <div className="page-hero-content">
          <h1>Forgot Password</h1>

          <p>Enter your email address and we’ll send you a link to reset your password.</p>
        </div>

        <div className="content-panel">
          <ForgotPasswordForm />
        </div>
      </section>

      <Footer />
    </main>
  )
}
