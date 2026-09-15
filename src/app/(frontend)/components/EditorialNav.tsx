import type { User } from '@/payload-types'

type Props = {
  user: User
  active?: 'editorial' | 'papers' | 'pages' | 'users' | 'trash'
}

export function EditorialNav({ user, active }: Props) {
  const canManageUsers = user.role === 'manager' || user.role === 'admin'

  return (
    <nav className="editorial-nav" aria-label="Editorial navigation">
      <div className="editorial-nav-inner">
        <a href="/editorial" className={active === 'editorial' ? 'is-active' : undefined}>
          Editorial
        </a>

        <a href="/editorial/submissions" className={active === 'papers' ? 'is-active' : undefined}>
          Papers
        </a>

        <a href="/editorial/pages/" className={active === 'pages' ? 'is-active' : undefined}>
          Pages
        </a>

        {canManageUsers && (
          <a href="/editorial/users" className={active === 'users' ? 'is-active' : undefined}>
            Users
          </a>
        )}

        <a href="/editorial/trash" className={active === 'trash' ? 'is-active' : undefined}>
          Trash
        </a>
      </div>
    </nav>
  )
}
