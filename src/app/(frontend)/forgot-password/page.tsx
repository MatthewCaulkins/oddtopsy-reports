import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export default function ForgotPasswordPage() {
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
