import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { EditorialNav } from '@/app/(frontend)/components/EditorialNav'

export default async function EditorialDashboardPage() {
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

  const canManageUsers = user.role === 'manager' || user.role === 'admin'

  const submissions = await payload.find({
    collection: 'submissions',
    where: {
      trashed: {
        not_equals: true,
      },
    },
    sort: '-updatedAt',
    limit: 5,
    depth: 0,
  })

  const trash = await payload.find({
    collection: 'submissions',
    where: {
      trashed: {
        equals: true,
      },
    },
    limit: 1,
    depth: 0,
  })

  const pendingUsers = canManageUsers
    ? await payload.find({
        collection: 'users',
        where: {
          role: {
            equals: 'pending',
          },
        },
        limit: 1,
        depth: 0,
      })
    : null

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="editorial" />

      <section className="page-hero page-editor">
        <h1>Editorial</h1>

        <p>Review submissions, manage site content, and maintain Oddtopsy Reports.</p>
      </section>

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>Papers</h2>

          <a href="/editorial/submissions">View all →</a>
        </div>

        {submissions.docs.length > 0 ? (
          <div className="editorial-dashboard-list">
            {submissions.docs.map((submission) => (
              <a key={submission.id} href={`/editorial/submissions/${submission.id}`}>
                <span>{submission.title || 'Untitled submission'}</span>

                <span className="editorial-dashboard-meta">{submission.workflowStatus}</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No submissions yet.</p>
          </div>
        )}
      </section>

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>Pages</h2>
        </div>

        <div className="editorial-dashboard-list">
          <a href="/editorial/pages/papers">
            <span>Papers</span>
            <span>Edit →</span>
          </a>

          <a href="/editorial/pages/submit">
            <span>Submit</span>
            <span>Edit →</span>
          </a>

          <a href="/editorial/pages/about">
            <span>About</span>
            <span>Edit →</span>
          </a>

          <a href="/editorial/pages/subscribe">
            <span>Subscribe</span>
            <span>Edit →</span>
          </a>
        </div>
      </section>

      {canManageUsers && (
        <section className="section editorial-dashboard-section">
          <div className="section-heading section-heading-rule">
            <h2>Users</h2>

            <a href="/editorial/users">Manage →</a>
          </div>

          <div className="editorial-dashboard-summary">
            {pendingUsers?.totalDocs ? (
              <p>
                <strong>{pendingUsers.totalDocs}</strong> pending account
                {pendingUsers.totalDocs === 1 ? ' request' : ' requests'}
              </p>
            ) : (
              <p>No pending account requests.</p>
            )}
          </div>
        </section>
      )}

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>Trash</h2>

          <a href="/editorial/trash">View trash →</a>
        </div>

        <div className="editorial-dashboard-summary">
          <p>
            <strong>{trash.totalDocs}</strong>{' '}
            {trash.totalDocs === 1 ? 'submission' : 'submissions'} in trash.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  )
}
