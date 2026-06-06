import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        {/* <p className="eyebrow">Editor login</p> */}
        <h1>Sign in to review submissions.</h1>
        <LoginForm />
      </section>
      <Footer />
    </main>
  )
}
