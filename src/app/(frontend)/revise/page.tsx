import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { getRevisionSubmission } from '@/lib/revisionAccess'

import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { SubmissionForm } from '../components/submission-form/SubmissionForm'
import { submitRevision } from './actions'

type Props = {
  searchParams: Promise<{
    submitted?: string
    expired?: string
  }>
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <h1>{title}</h1>
        <p>{body}</p>

        <Link href="/" className="button secondary">
          Return home
        </Link>
      </section>

      <Footer />
    </main>
  )
}

export default async function RevisePage({ searchParams }: Props) {
  const { submitted } = await searchParams

  if (submitted) {
    return (
      <Message
        title="Thank you for your revision."
        body="The editorial team has been notified and will review your updated submission."
      />
    )
  }

  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const submission = await getRevisionSubmission(payload, headers)

  if (!submission) {
    return (
      <Message
        title="This revision link is no longer active."
        body="It may have expired, already been used, or been replaced by a newer request. Please contact the editors if you still need to revise your submission."
      />
    )
  }

  const [revisionRequests, focusAreas] = await Promise.all([
    payload.find({
      collection: 'editor-notes',
      where: {
        and: [
          { submission: { equals: submission.id } },
          { noteType: { equals: 'revision_request' } },
        ],
      },
      sort: '-createdAt',
      limit: 10,
      depth: 0,
    }),
    payload.find({
      collection: 'focus-areas',
      limit: 100,
      sort: 'name',
    }),
  ])

  const [latestRequest, ...earlierRequests] = revisionRequests.docs

  return (
    <main className="site">
      <Header />

      <section className="page-hero">
        <h1>Revise your submission</h1>
        <p>
          The editors have requested revisions to <strong>{submission.title}</strong>. Update your
          submission below and submit it when you are ready.
        </p>

        {latestRequest && (
          <article className="editorial-revision-note">
            <p className="editorial-dashboard-meta">
              Requested{' '}
              {new Date(latestRequest.createdAt).toLocaleDateString('en-US', {
                dateStyle: 'long',
              })}
            </p>

            <p>{latestRequest.note}</p>
          </article>
        )}

        {earlierRequests.length > 0 && (
          <details className="editorial-revisions">
            <summary>Earlier requests ({earlierRequests.length})</summary>

            {earlierRequests.map((request) => (
              <article key={request.id} className="editorial-revision-note">
                <p className="editorial-dashboard-meta">
                  {new Date(request.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
                </p>

                <p>{request.note}</p>
              </article>
            ))}
          </details>
        )}

        <SubmissionForm
          mode="edit"
          focusAreas={focusAreas.docs}
          submission={submission}
          action={submitRevision}
          submitLabel="Submit Revision"
        />
      </section>

      <Footer />
    </main>
  )
}
