import type { User } from '@/payload-types'

export type Role = User['role']

export type ActiveRole = Exclude<Role, 'pending'>

const roleRank: Record<Role, number> = {
  pending: 0,
  editor: 1,
  manager: 2,
  admin: 3,
}

/*
 * True when the user holds at least the given role.
 * Pending users and anonymous visitors never pass.
 */
export function hasRole(user: { role?: Role | null } | null | undefined, minimum: ActiveRole) {
  if (!user?.role) return false

  return roleRank[user.role] >= roleRank[minimum]
}

type RoleHolder = {
  id: number | string
  role?: Role | null
}

export const assignableRoles = ['pending', 'editor', 'manager'] as const satisfies Role[]

export function isAssignableRole(value: unknown): value is (typeof assignableRoles)[number] {
  return assignableRoles.includes(value as (typeof assignableRoles)[number])
}

/*
 * Who may change whose role:
 * - There is a single admin. No one can grant admin, and the
 *   admin account cannot be changed from the app.
 * - No one changes their own role.
 * - Managers change pending users and editors (to pending,
 *   editor or manager), but not other managers.
 * - The admin changes anyone else.
 */
export function canAssignRole(
  actor: RoleHolder | null | undefined,
  target: RoleHolder | null | undefined,
  newRole: unknown,
) {
  if (!actor || !target || !isAssignableRole(newRole)) return false

  if (target.role === 'admin') return false

  if (String(actor.id) === String(target.id)) return false

  if (hasRole(actor, 'admin')) return true

  if (hasRole(actor, 'manager')) {
    return target.role === 'pending' || target.role === 'editor'
  }

  return false
}

/*
 * Whether the actor can change this user's role at all, used to
 * decide whether the Users page shows a role picker.
 */
export function canManageUser(actor: RoleHolder | null | undefined, target: RoleHolder) {
  return assignableRoles.some((role) => canAssignRole(actor, target, role))
}
