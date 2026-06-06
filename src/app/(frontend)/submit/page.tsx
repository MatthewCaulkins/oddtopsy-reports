import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SubmitForm } from './SubmitForm'

export default function SubmitPage() {
  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        {/* <p className="eyebrow">Submit a paper</p> */}
        <h1>Share an unusual anatomical or autopsy finding.</h1>
        <p>
          Upload a completed manuscript PDF or draft the paper directly in the editor. Editors will
          review the submission and follow up if revisions are needed.
        </p>

        <SubmitForm />
      </section>
      <Footer />
    </main>
  )
}
