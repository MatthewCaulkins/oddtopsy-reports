import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'

function getInitials(email?: string | null) {
  if (!email) return 'U'

  return email
    .split('@')[0]
    .split(/[.\-_]/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default async function AdminUserMenu() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })

  if (!user) return null

  return (
    <details className="admin-user-menu">
      <summary>{getInitials(user.email)}</summary>

      <div className="admin-user-menu__panel">
        <Link href="/">Front End</Link>

        <Link href="/editorial">Editorial</Link>

        <Link href="/admin/account">Account</Link>

        <Link href="/logout">Logout</Link>
      </div>
    </details>
  )
}
