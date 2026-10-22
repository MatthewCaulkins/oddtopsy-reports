import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

import { createSignedValue } from '@/lib/signedCookies'
import { RequestAccessForm } from './RequestAccessForm'

// The form token records when the form was shown, so it must be issued per request.
export const dynamic = 'force-dynamic'

export default function RequestAccessPage() {
  const formToken = createSignedValue({ startedAt: Date.now() }, 24 * 60 * 60)

  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <h1>Request editorial access.</h1>

        <p>
          Editorial accounts are for the Oddtopsy Reports editorial team. Tell us who you are and
          an administrator will review your request. You do not need an account to submit a paper.
        </p>

        <RequestAccessForm formToken={formToken} />
      </section>

      <Footer />
    </main>
  )
}
