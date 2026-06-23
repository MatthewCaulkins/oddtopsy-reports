import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { Breadcrumbs } from '@/app/(frontend)/components/Breadcrumbs'
import { Header } from '../../../components/Header'
import { Footer } from '../../../components/Footer'
import { approveSubmission } from './actions'

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function EditorialSubmissionPage({ params }: Props) {
  const { id } = await params
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login')
  }

  const submission = await payload.findByID({
    collection: 'submissions',
    id,
    depth: 2,
  })

  if (!submission) notFound()

  const pdf =
    typeof submission.manuscriptPDF === 'object' && submission.manuscriptPDF?.url
      ? submission.manuscriptPDF.url
      : null

  return (
    <main className="site">
      <Header />
      <Breadcrumbs items={[{ label: 'Papers', href: '/articles' }, { label: submission.title }]} />

      <section className="page-hero">
        {/* <p className="eyebrow">Editorial review</p> */}
        <h1>{submission.title}</h1>

        <div className="review-layout">
          <aside className="review-sidebar">
            <p className="card-label">Status</p>
            <h3>{submission.status}</h3>

            <p className="card-label">Corresponding Author</p>
            <p>{submission.correspondingAuthor?.name}</p>
            <p>{submission.correspondingAuthor?.email}</p>
            <p>{submission.correspondingAuthor?.affiliation}</p>

            <form action={approveSubmission}>
              <input type="hidden" name="id" value={submission.id} />
              <button className="button primary" type="submit">
                Approve & Publish
              </button>
            </form>
          </aside>

          <article className="review-main">
            {submission.abstract && (
              <>
                {/* <p className="eyebrow">Abstract</p> */}
                <p>{submission.abstract}</p>
              </>
            )}

            {pdf && <iframe className="pdf-frame" src={pdf} title={submission.title} />}

            {submission.submissionType === 'editor' && (
              <div className="rich-output">
                <pre>{JSON.stringify(submission.manuscriptBody, null, 2)}</pre>
              </div>
            )}
          </article>
        </div>
      </section>
      <Footer />
    </main>
  )
}
