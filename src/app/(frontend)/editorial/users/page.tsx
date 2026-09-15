import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { EditorialNav } from '../../components/EditorialNav'

import { approveUser, rejectUser, updateUserRole, promoteToAdmin } from './actions'

export default async function EditorialUsersPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'manager' && user.role !== 'admin') {
    redirect('/articles')
  }

  const users = await payload.find({
    collection: 'users',
    sort: '-createdAt',
    limit: 100,
  })

  const pendingUsers = users.docs.filter((item) => item.role === 'pending')

  const activeUsers = users.docs.filter((item) => item.role !== 'pending')

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="users" />

      <section className="page-hero page-editor">
        <h1>Users</h1>

        <p>Review account requests and manage editorial permissions.</p>
      </section>

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>Pending Requests</h2>
        </div>

        {pendingUsers.length > 0 ? (
          <div className="editorial-user-list">
            {pendingUsers.map((item) => (
              <article key={item.id} className="editorial-user-row">
                <div>
                  <strong>{item.profile?.displayName || item.email}</strong>

                  <p>{item.email}</p>
                </div>

                <div className="editorial-user-actions">
                  <form action={approveUser}>
                    <input type="hidden" name="id" value={item.id} />

                    <button className="button primary" type="submit">
                      Approve as Editor
                    </button>
                  </form>

                  <form action={rejectUser}>
                    <input type="hidden" name="id" value={item.id} />

                    <button className="button secondary" type="submit">
                      Reject
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No pending account requests.</p>
          </div>
        )}
      </section>

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>Editorial Users</h2>
        </div>

        <div className="editorial-user-list">
          {activeUsers.map((item) => {
            const isCurrentUser = Number(item.id) === Number(user.id)

            return (
              <article key={item.id} className="editorial-user-row">
                <div>
                  <strong>{item.profile?.displayName || item.email}</strong>

                  <p>{item.email}</p>
                </div>

                <div className="editorial-user-actions">
                  {item.role === 'admin' ? (
                    <span className="editorial-role-badge">Admin</span>
                  ) : (
                    <>
                      <form action={updateUserRole}>
                        <input type="hidden" name="id" value={item.id} />

                        <select
                          name="role"
                          defaultValue={item.role}
                          disabled={isCurrentUser && user.role === 'manager'}
                        >
                          <option value="editor">Editor</option>

                          <option value="manager">Manager</option>

                          <option value="pending">Pending</option>
                        </select>

                        <button
                          className="button secondary"
                          type="submit"
                          disabled={isCurrentUser && user.role === 'manager'}
                        >
                          Update Role
                        </button>
                      </form>

                      {user.role === 'admin' && (
                        <form action={promoteToAdmin}>
                          <input type="hidden" name="id" value={item.id} />

                          <button className="button secondary" type="submit">
                            Make Admin
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <Footer />
    </main>
  )
}
