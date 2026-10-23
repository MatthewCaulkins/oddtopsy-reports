'use client'

import { useState, useTransition } from 'react'

import type { AccountStatus, Role } from '@/access/roles'

import {
  changeAccountStatus,
  changeUserRole,
  deleteUserAccount,
  resendUserInvite,
  sendUserSignInInvite,
  type UserActionResult,
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

type Props = {
  userID: number
  name: string
  email: string
  initialRole: Role
  initialStatus: AccountStatus
  canManage: boolean
  // Admins may delete accounts they can manage.
  canDelete: boolean
  grantableRoles: readonly Role[]
  // Cognito is enabled and this account has no Cognito sign-in yet.
  needsSignInInvite: boolean
}

/*
 * One user on the Users page: who they are on the left, actions on the
 * right. State is local so the row updates as soon as you act: disabling
 * hides the role controls, and re-enabling brings them back. If the
 * server refuses (for example, the last active admin), the row reverts
 * and shows why. Every change is still authorized on the server.
 */
export function UserAccountControls({
  userID,
  name,
  email,
  initialRole,
  initialStatus,
  canManage,
  canDelete,
  grantableRoles,
  needsSignInInvite,
}: Props) {
  const [role, setRole] = useState(initialRole)
  const [selectedRole, setSelectedRole] = useState(initialRole)
  const [status, setStatus] = useState(initialStatus)
  const [signInInviteNeeded, setSignInInviteNeeded] = useState(needsSignInInvite)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleted, setDeleted] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function apply(result: UserActionResult, revert?: () => void) {
    if (!result.ok) {
      revert?.()
      setMessage({ kind: 'error', text: result.error })
      return false
    }

    if (result.role) {
      setRole(result.role)
      setSelectedRole(result.role)
    }

    if (result.accountStatus) setStatus(result.accountStatus)

    setMessage(result.message ? { kind: 'success', text: result.message } : null)

    return true
  }

  function toggleStatus() {
    const previous = status
    const next = status === 'disabled' ? 'active' : 'disabled'

    setMessage(null)
    setStatus(next) // optimistic: controls update immediately

    startTransition(async () => {
      apply(await changeAccountStatus(userID, next), () => setStatus(previous))
    })
  }

  function updateRole() {
    setMessage(null)

    startTransition(async () => {
      apply(await changeUserRole(userID, selectedRole), () => setSelectedRole(role))
    })
  }

  function send(action: (id: number) => Promise<UserActionResult>, onSuccess?: () => void) {
    setMessage(null)

    startTransition(async () => {
      if (apply(await action(userID))) onSuccess?.()
    })
  }

  function deleteAccount() {
    setMessage(null)

    startTransition(async () => {
      if (apply(await deleteUserAccount(userID, confirmEmail))) setDeleted(true)
    })
  }

  if (deleted) {
    return (
      <article className="editorial-user-row is-deleted">
        <div>
          <strong>{name}</strong>
          <p className="form-success" role="status">
            {email} was deleted. The address can be used for a new access request.
          </p>
        </div>
      </article>
    )
  }

  const isDisabled = status === 'disabled'
  const confirmationMatches = confirmEmail.trim().toLowerCase() === email.toLowerCase()

  return (
    <article className="editorial-user-row">
      <div className="editorial-user-identity">
        <strong>{name}</strong>
        <p>{email}</p>
        <p className="editorial-dashboard-meta">{statusLabels[status]}</p>
      </div>

      {canManage ? (
        <div className="editorial-user-actions">
          {!isDisabled && (
            <>
              <div className="select-wrap">
                <select
                  name="role"
                  aria-label={`Role for ${name}`}
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value as Role)}
                  disabled={pending}
                >
                  {grantableRoles.map((option) => (
                    <option key={option} value={option}>
                      {roleLabels[option]}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="button secondary"
                type="button"
                onClick={updateRole}
                disabled={pending || selectedRole === role}
              >
                Update Role
              </button>
            </>
          )}

          {status === 'invited' && (
            <button className="button secondary" type="button" onClick={() => send(resendUserInvite)} disabled={pending}>
              Resend Invite
            </button>
          )}

          {signInInviteNeeded && status === 'active' && (
            <button
              className="button secondary"
              type="button"
              onClick={() => send(sendUserSignInInvite, () => setSignInInviteNeeded(false))}
              disabled={pending}
            >
              Send Sign-in Invite
            </button>
          )}

          <button className="button secondary" type="button" onClick={toggleStatus} disabled={pending}>
            {isDisabled ? 'Re-enable' : 'Disable'}
          </button>

          {canDelete && !confirmingDelete && (
            <button
              className="button secondary button-danger"
              type="button"
              onClick={() => {
                setMessage(null)
                setConfirmingDelete(true)
              }}
              disabled={pending}
            >
              Delete
            </button>
          )}
        </div>
      ) : (
        <div className="editorial-user-actions">
          <span className="editorial-role-badge">{roleLabels[role]}</span>
        </div>
      )}

      {confirmingDelete && (
        <div className="editorial-user-delete" role="alertdialog" aria-label={`Delete ${name}`}>
          <p>
            <strong>Permanently delete {email}?</strong> This removes their Cognito sign-in and their
            account, and cannot be undone. Their notes and review history are kept, attributed to “a
            former user”. To keep the account recoverable, disable it instead.
          </p>

          <label>
            Type <strong>{email}</strong> to confirm
            <input
              type="email"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              autoComplete="off"
              disabled={pending}
            />
          </label>

          <div className="editorial-user-actions">
            <button
              className="button primary button-danger"
              type="button"
              onClick={deleteAccount}
              disabled={pending || !confirmationMatches}
            >
              {pending ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setConfirmingDelete(false)
                setConfirmEmail('')
              }}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`editorial-user-message ${message.kind === 'error' ? 'form-error' : 'form-success'}`} role="status">
          {message.text}
        </p>
      )}
    </article>
  )
}
