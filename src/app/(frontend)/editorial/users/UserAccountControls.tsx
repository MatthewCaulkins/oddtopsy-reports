'use client'

import { useState, useTransition } from 'react'

import type { AccountStatus, Role } from '@/access/roles'

import {
  changeAccountStatus,
  changeUserRole,
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
  initialRole: Role
  initialStatus: AccountStatus
  canManage: boolean
  grantableRoles: readonly Role[]
  // Cognito is enabled and this account has no Cognito sign-in yet.
  needsSignInInvite: boolean
}

/*
 * Role and status controls for one user. State is local so the row
 * updates as soon as you act: disabling hides the role controls, and
 * re-enabling brings them back. If the server refuses (for example,
 * the last active admin), the row reverts and shows why. Every change
 * is still authorized on the server.
 */
export function UserAccountControls({
  userID,
  initialRole,
  initialStatus,
  canManage,
  grantableRoles,
  needsSignInInvite,
}: Props) {
  const [role, setRole] = useState(initialRole)
  const [selectedRole, setSelectedRole] = useState(initialRole)
  const [status, setStatus] = useState(initialStatus)
  const [signInInviteNeeded, setSignInInviteNeeded] = useState(needsSignInInvite)
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

  const isDisabled = status === 'disabled'

  return (
    <>
      <p className="editorial-dashboard-meta">{statusLabels[status]}</p>

      {canManage ? (
        <div className="editorial-user-actions">
          {!isDisabled && (
            <>
              <div className="select-wrap">
                <select
                  name="role"
                  aria-label="Role"
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
        </div>
      ) : (
        <div className="editorial-user-actions">
          <span className="editorial-role-badge">{roleLabels[role]}</span>
        </div>
      )}

      {message && (
        <p className={message.kind === 'error' ? 'form-error' : 'form-success'} role="status">
          {message.text}
        </p>
      )}
    </>
  )
}
