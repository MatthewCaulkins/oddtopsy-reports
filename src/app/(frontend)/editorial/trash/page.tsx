import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { EditorialNav } from '../../components/EditorialNav'

import { restoreSubmission, deleteSubmissionPermanently, emptyTrash } from './actions'

export default async function EditorialTrashPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'editor' && user.role !== 'manager' && user.role !== 'admin') {
    redirect('/articles')
  }

  const trashed = await payload.find({
    collection: 'submissions',
    where: {
      trashed: {
        equals: true,
      },
    },
    sort: '-trashedAt',
    depth: 1,
    limit: 100,
  })

  const canDeletePermanently = user.role === 'manager' || user.role === 'admin'

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="trash" />

      <section className="page-hero page-editor">
        <h1>Trash</h1>

        <p>Restore submissions or permanently remove them.</p>
      </section>

      <section className="section editorial-section">
        {canDeletePermanently && trashed.docs.length > 0 && (
          <div className="editorial-section-actions">
            <form action={emptyTrash}>
              <button className="button secondary" type="submit">
                Empty Trash
              </button>
            </form>
          </div>
        )}

        {trashed.docs.length > 0 ? (
          <div className="editorial-trash-list">
            {trashed.docs.map((submission) => (
              <article key={submission.id} className="editorial-trash-row">
                <div className="editorial-trash-info">
                  <h3>{submission.title}</h3>

                  {submission.trashedAt && (
                    <p>Trashed {new Date(submission.trashedAt).toLocaleDateString()}</p>
                  )}
                </div>

                <div className="editorial-trash-actions">
                  <form action={restoreSubmission}>
                    <input type="hidden" name="id" value={submission.id} />

                    <button className="button primary" type="submit">
                      Restore
                    </button>
                  </form>

                  {canDeletePermanently && (
                    <form action={deleteSubmissionPermanently}>
                      <input type="hidden" name="id" value={submission.id} />

                      <button className="button secondary" type="submit">
                        Delete Permanently
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Trash is empty.</h3>

            <p>Removed submissions will appear here.</p>
          </div>
        )}
      </section>

      <Footer />
    </main>
  )
}
