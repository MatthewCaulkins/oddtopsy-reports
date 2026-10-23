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

// Roles granted when approving an access request. Admin is never granted there.
export const assignableRoles = ['editor', 'manager'] as const satisfies Role[]

export type AssignableRole = (typeof assignableRoles)[number]

export function isAssignableRole(value: unknown): value is AssignableRole {
  return assignableRoles.includes(value as AssignableRole)
}

const allRoles = ['editor', 'manager', 'admin'] as const satisfies Role[]

export function isRole(value: unknown): value is Role {
  return allRoles.includes(value as Role)
}

/*
 * Roles the actor may choose on the Users page: admins may also grant
 * admin; managers choose between editor and manager.
 */
export function rolesGrantableBy(actor: AccountHolder | null | undefined): readonly Role[] {
  if (hasRole(actor, 'admin')) return allRoles
  if (hasRole(actor, 'manager')) return assignableRoles

  return []
}

export const settableAccountStatuses = ['active', 'disabled'] as const satisfies AccountStatus[]

export type SettableAccountStatus = (typeof settableAccountStatuses)[number]

export function isSettableAccountStatus(value: unknown): value is SettableAccountStatus {
  return settableAccountStatuses.includes(value as SettableAccountStatus)
}

/*
 * Who may manage whose account (role and status):
 * - No one manages their own account, admins included.
 * - Admins manage everyone else, including other admins.
 * - Managers manage editors only.
 * The last active admin is additionally protected in the Users
 * collection hooks (src/lib/auth/adminGuard.ts).
 */
export function canManageUser(
  actor: AccountHolder | null | undefined,
  target: AccountHolder | null | undefined,
) {
  if (!actor || !target) return false

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
  return isRole(newRole) && rolesGrantableBy(actor).includes(newRole) && canManageUser(actor, target)
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
