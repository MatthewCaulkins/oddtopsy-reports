import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { EditorialNav } from '@/app/(frontend)/components/EditorialNav'

export default async function EditorialSubmissionsPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({
    headers,
  })

  if (!user) {
    redirect('/login')
  }

  const canEdit = user.role === 'editor' || user.role === 'manager' || user.role === 'admin'

  if (!canEdit) {
    redirect('/articles')
  }

  const submissions = await payload.find({
    collection: 'submissions',

    where: {
      trashed: {
        not_equals: true,
      },
    },

    sort: '-updatedAt',
    limit: 100,
    depth: 1,
  })

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="papers" />

      <section className="page-hero page-editor">
        <h1>Papers</h1>

        <p>Review submissions and manage their editorial status.</p>
      </section>

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>All Submissions</h2>

          <span>{submissions.totalDocs}</span>
        </div>

        {submissions.docs.length > 0 ? (
          <div className="editorial-dashboard-list">
            {submissions.docs.map((submission) => (
              <a key={submission.id} href={`/editorial/submissions/${submission.id}`}>
                <div>
                  <strong>{submission.title || 'Untitled submission'}</strong>

                  {submission.subtitle && <p>{submission.subtitle}</p>}
                </div>

                <span className="editorial-dashboard-meta">{submission.workflowStatus}</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No submissions yet.</h3>

            <p>New submissions will appear here.</p>
          </div>
        )}
      </section>

      <Footer />
    </main>
  )
}
