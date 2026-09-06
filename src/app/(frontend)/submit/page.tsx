import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SubmissionForm } from '../components/submission-form/SubmissionForm'
import { submitPaper } from './actions'

import { getSiteContent } from '@/lib/getSiteContent'
import { EditPageButton } from '../components/site-content/EditPageButton'

export default async function SubmitPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  const [focusAreas, pageContent] = await Promise.all([
    payload.find({
      collection: 'focus-areas',
      limit: 100,
      sort: 'name',
    }),

    getSiteContent('submit'),
  ])

  return (
    <main className="site">
      <Header />

      {user && <EditPageButton page="submit" />}

      <section className="page-hero">
        <h1>{pageContent?.heroTitle || 'Share an unusual anatomical or autopsy finding.'}</h1>

        {pageContent?.heroBody && <p>{pageContent.heroBody}</p>}

        {pageContent?.content && (
          <div
            className="rich-output site-content-output"
            dangerouslySetInnerHTML={{
              __html: pageContent.content,
            }}
          />
        )}

        <SubmissionForm
          mode="create"
          focusAreas={focusAreas.docs}
          action={submitPaper}
          submitLabel="Submit Paper"
          allowMediaLibrary={Boolean(user)}
        />
      </section>

      <Footer />
    </main>
  )
}
