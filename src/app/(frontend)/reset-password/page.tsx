import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { ResetPasswordForm } from './ResetPasswordForm'

type Props = {
  searchParams: Promise<{
    token?: string
  }>
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams

  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <div className="page-hero-content">
          <h1>Reset Password</h1>

          <p>Choose a new password for your Oddtopsy Reports account.</p>
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
