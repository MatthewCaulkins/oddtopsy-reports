import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { SignupForm } from './SignupForm'

export default function SignupPage() {
  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <h1>Request an editor account.</h1>

        <p>
          Create an account request for Oddtopsy Reports. An administrator must approve your account
          before you can sign in.
        </p>

        <SignupForm />
      </section>

      <Footer />
    </main>
  )
}
