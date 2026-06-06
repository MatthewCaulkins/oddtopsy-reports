import Link from 'next/link'
import { Header } from '../../components/Header'
import { Footer } from '../../components/Footer'

export default function SubmitThankYouPage() {
  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        {/* <p className="eyebrow">Submission received</p> */}
        <h1>Thank you for submitting your paper.</h1>
        <p>The editorial team will review your submission and follow up if needed.</p>

        <Link href="/" className="button secondary">
          Return home
        </Link>
      </section>
      <Footer />
    </main>
  )
}
