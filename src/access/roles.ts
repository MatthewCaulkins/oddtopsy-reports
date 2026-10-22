import type { User } from '@/payload-types'

export type Role = User['role']

export type AccountStatus = NonNullable<User['accountStatus']>

const roleRank: Record<Role, number> = {
  editor: 1,
  manager: 2,
  admin: 3,
}

type AccountHolder = {
  id: number | string
  role?: Role | null
  accountStatus?: AccountStatus | null
}

/*
 * Role says what someone may do; account status says whether they
 * may do it right now. Only active accounts get editorial access.
 * Invited accounts become active on first sign-in; disabled ones
 * keep their role but lose access.
 */
export function isActive(user: Pick<AccountHolder, 'accountStatus'> | null | undefined) {
  return user?.accountStatus === 'active'
}

/*
 * True when the user is active and holds at least the given role.
 * Anonymous visitors never pass.
 */
export function hasRole(
  user: Pick<AccountHolder, 'role' | 'accountStatus'> | null | undefined,
  minimum: Role,
) {
  if (!user?.role || !isActive(user)) return false

  return roleRank[user.role] >= roleRank[minimum]
}

export const assignableRoles = ['editor', 'manager'] as const satisfies Role[]

export type AssignableRole = (typeof assignableRoles)[number]

export function isAssignableRole(value: unknown): value is AssignableRole {
  return assignableRoles.includes(value as AssignableRole)
}

export const settableAccountStatuses = ['active', 'disabled'] as const satisfies AccountStatus[]

export type SettableAccountStatus = (typeof settableAccountStatuses)[number]

export function isSettableAccountStatus(value: unknown): value is SettableAccountStatus {
  return settableAccountStatuses.includes(value as SettableAccountStatus)
}

/*
 * Who may manage whose account (role and status):
 * - There is a single admin. No one can grant admin, and the
 *   admin account cannot be changed from the app.
 * - No one manages their own account.
 * - Managers manage editors, but not other managers.
 * - The admin manages everyone else.
 */
export function canManageUser(
  actor: AccountHolder | null | undefined,
  target: AccountHolder | null | undefined,
) {
  if (!actor || !target) return false

  if (target.role === 'admin') return false

  if (String(actor.id) === String(target.id)) return false

  if (hasRole(actor, 'admin')) return true

  if (hasRole(actor, 'manager')) return target.role === 'editor'

  return false
}

export function canAssignRole(
  actor: AccountHolder | null | undefined,
  target: AccountHolder | null | undefined,
  newRole: unknown,
) {
  return isAssignableRole(newRole) && canManageUser(actor, target)
}

/*
 * 'invited' is only set by provisioning, never chosen by staff.
 */
export function canSetAccountStatus(
  actor: AccountHolder | null | undefined,
  target: AccountHolder | null | undefined,
  newStatus: unknown,
) {
  return isSettableAccountStatus(newStatus) && canManageUser(actor, target)
}

/*
 * Approving an access request: managers and the admin may grant
 * Editor or Manager. Admin is never granted through approval.
 */
export function canGrantOnApproval(actor: AccountHolder | null | undefined, role: unknown) {
  return hasRole(actor, 'manager') && isAssignableRole(role)
}
