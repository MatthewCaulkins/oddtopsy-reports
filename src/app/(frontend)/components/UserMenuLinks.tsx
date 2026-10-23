'use client'

import { usePathname } from 'next/navigation'

import { LogoutButton } from '@/components/LogoutButton'

type Props = {
  canUseEditorial: boolean
  isAdmin: boolean
}

/*
 * The profile menu's destinations, aware of where you are: inside
 * Editorial it names Editorial as the current section and offers the
 * public site instead.
 */
export function UserMenuLinks({ canUseEditorial, isAdmin }: Props) {
  const pathname = usePathname() || '/'
  const inEditorial = pathname === '/editorial' || pathname.startsWith('/editorial/')

  return (
    <div className="user-menu-panel">
      {canUseEditorial &&
        (inEditorial ? (
          <>
            <span className="user-menu-current" aria-current="page">
              Editorial
            </span>
            <a href="/">Frontend</a>
          </>
        ) : (
          <a href="/editorial">Editorial</a>
        ))}

      {isAdmin && <a href="/admin">Admin Panel</a>}

      <LogoutButton className="user-menu-logout" />
    </div>
  )
}
