import { Header } from '@/app/(frontend)/components/Header'
import { Footer } from '@/app/(frontend)/components/Footer'
import { EditorialNav } from '../../components/EditorialNav'

import { canManageUser, rolesGrantableBy, type AccountStatus, type Role } from '@/access/roles'
import type { AccessRequest, User } from '@/payload-types'
import { requireRole } from '@/lib/requireRole'

import {
  approveRequest,
  rejectRequest,
  resendUserInvite,
  retryProvisioning,
  setAccountStatus,
  updateUserRole,
} from './actions'

const roleLabels: Record<Role, string> = {
  editor: 'Editor',
  manager: 'Manager',
  admin: 'Admin',
}

const statusLabels: Record<AccountStatus, string> = {
  invited: 'Invited',
  active: 'Active',
  disabled: 'Disabled',
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : ''
}

function personName(value: AccessRequest['reviewer'] | AccessRequest['user']) {
  if (!value || typeof value !== 'object') return 'a former user'

  return (value as User).profile?.displayName || (value as User).email
}

export default async function EditorialUsersPage() {
  const { payload, user } = await requireRole('manager')

  const grantableRoles = rolesGrantableBy(user)

  const [pendingRequests, failedProvisioning, recentDecisions, users] = await Promise.all([
    payload.find({
      collection: 'access-requests',
      where: { status: { equals: 'pending' } },
      sort: 'createdAt',
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: 'access-requests',
      where: {
        and: [{ status: { equals: 'approved' } }, { 'provisioning.status': { not_equals: 'complete' } }],
      },
      sort: '-decisionDate',
      pagination: false,
      depth: 1,
    }),
    payload.find({
      collection: 'access-requests',
      where: { status: { not_equals: 'pending' } },
      sort: '-decisionDate',
      limit: 20,
      depth: 1,
    }),
    payload.find({
      collection: 'users',
      sort: '-createdAt',
      limit: 200,
      depth: 0,
    }),
  ])

  return (
    <main className="site">
      <Header />

      <EditorialNav user={user} active="users" />

      <section className="page-hero page-editor">
        <h1>Users</h1>

        <p>Review access requests and manage editorial accounts.</p>
      </section>

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>Pending Requests</h2>
        </div>

        {pendingRequests.docs.length > 0 ? (
          <div className="editorial-user-list">
            {pendingRequests.docs.map((request) => (
              <article key={request.id} className="editorial-user-row">
                <div>
                  <strong>{request.name}</strong>

                  <p>{request.email}</p>

                  <p className="editorial-dashboard-meta">
                    {request.affiliation} · Requested {formatDate(request.createdAt)}
                    {request.source === 'migrated' && ' · from an earlier signup'}
                  </p>
                </div>

                <div className="editorial-user-actions">
                  <form action={approveRequest}>
                    <input type="hidden" name="id" value={request.id} />

                    <div className="select-wrap">
                      <select name="role" defaultValue="editor" aria-label="Role to grant">
                        <option value="editor">Editor</option>
                        <option value="manager">Manager</option>
                      </select>
                    </div>

                    <button className="button primary" type="submit">
                      Approve
                    </button>
                  </form>

                  <details className="editorial-toolbar-panel">
                    <summary className="button secondary">Reject</summary>

                    <form action={rejectRequest} className="editorial-toolbar-panel-body">
                      <input type="hidden" name="id" value={request.id} />

                      <label>
                        Note (optional, kept for the record)
                        <textarea name="rejectionNote" rows={3} />
                      </label>

                      <button className="button secondary" type="submit">
                        Reject Request
                      </button>
                    </form>
                  </details>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No pending access requests.</p>
          </div>
        )}
      </section>

      {failedProvisioning.docs.length > 0 && (
        <section className="section editorial-dashboard-section">
          <div className="section-heading section-heading-rule">
            <h2>Needs Attention</h2>
          </div>

          <div className="editorial-user-list">
            {failedProvisioning.docs.map((request) => (
              <article key={request.id} className="editorial-user-row">
                <div>
                  <strong>{request.name}</strong>

                  <p>{request.email}</p>

                  <p className="form-error">
                    Approved, but the account invite was not sent
                    {request.provisioning?.lastError && `: ${request.provisioning.lastError}`}
                  </p>

                  <p className="editorial-dashboard-meta">
                    {request.provisioning?.attempts || 0} attempt(s) · last{' '}
                    {formatDate(request.provisioning?.lastAttemptAt)}
                  </p>
                </div>

                <div className="editorial-user-actions">
                  <form action={retryProvisioning}>
                    <input type="hidden" name="id" value={request.id} />

                    <button className="button primary" type="submit">
                      Retry Invite
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section editorial-dashboard-section">
        <div className="section-heading section-heading-rule">
          <h2>Editorial Users</h2>
        </div>

        <div className="editorial-user-list">
          {users.docs.map((item) => {
            const canManage = canManageUser(user, item)

            return (
              <article key={item.id} className="editorial-user-row">
                <div>
                  <strong>{item.profile?.displayName || item.email}</strong>

                  <p>{item.email}</p>

                  <p className="editorial-dashboard-meta">{statusLabels[item.accountStatus]}</p>
                </div>

                <div className="editorial-user-actions">
                  {canManage ? (
                    <>
                      <form key={`${item.id}-${item.role}`} action={updateUserRole}>
                        <input type="hidden" name="id" value={item.id} />

                        <div className="select-wrap">
                          <select name="role" defaultValue={item.role} aria-label="Role">
                            {grantableRoles.map((role) => (
                              <option key={role} value={role}>
                                {roleLabels[role]}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button className="button secondary" type="submit">
                          Update Role
                        </button>
                      </form>

                      {item.accountStatus === 'invited' && (
                        <form action={resendUserInvite}>
                          <input type="hidden" name="id" value={item.id} />

                          <button className="button secondary" type="submit">
                            Resend Invite
                          </button>
                        </form>
                      )}

                      <form action={setAccountStatus}>
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          type="hidden"
                          name="accountStatus"
                          value={item.accountStatus === 'disabled' ? 'active' : 'disabled'}
                        />

                        <button className="button secondary" type="submit">
                          {item.accountStatus === 'disabled' ? 'Re-enable' : 'Disable'}
                        </button>
                      </form>
                    </>
                  ) : (
                    <span className="editorial-role-badge">{roleLabels[item.role]}</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {recentDecisions.docs.length > 0 && (
        <section className="section editorial-dashboard-section">
          <div className="section-heading section-heading-rule">
            <h2>Recent Decisions</h2>
          </div>

          <div className="editorial-user-list">
            {recentDecisions.docs.map((request) => (
              <article key={request.id} className="editorial-user-row">
                <div>
                  <strong>{request.name}</strong>

                  <p>{request.email}</p>

                  <p className="editorial-dashboard-meta">
                    {request.status === 'approved'
                      ? `Approved as ${request.grantedRole ? roleLabels[request.grantedRole] : '—'}`
                      : 'Rejected'}{' '}
                    by {personName(request.reviewer)} on {formatDate(request.decisionDate)}
                  </p>

                  {request.rejectionNote && (
                    <p className="editorial-dashboard-meta">Note: {request.rejectionNote}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </main>
  )
}
