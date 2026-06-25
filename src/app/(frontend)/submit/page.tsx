import { getPayload } from 'payload'
import config from '@/payload.config'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SubmissionForm } from '../components/submission-form/SubmissionForm'
import { submitPaper } from './actions'

export default async function SubmitPage() {
  const payload = await getPayload({ config })

  const focusAreas = await payload.find({
    collection: 'focus-areas',
    limit: 100,
    sort: 'name',
  })

  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <h1>Share an unusual anatomical or autopsy finding.</h1>
        <p>
          Upload a completed manuscript PDF or draft the paper directly in the editor. Editors will
          review the submission and follow up if revisions are needed.
        </p>

        <SubmissionForm
          mode="create"
          focusAreas={focusAreas.docs}
          action={submitPaper}
          submitLabel="Submit Paper"
        />
      </section>

      <Footer />
    </main>
  )
}