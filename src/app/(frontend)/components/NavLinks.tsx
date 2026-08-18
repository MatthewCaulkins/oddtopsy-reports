'use client'

import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/articles', label: 'Papers' },
  { href: '/submit', label: 'Submit' },
  { href: '/about', label: 'About' },
  { href: '/subscribe', label: 'Subscribe' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <>
      {navItems.map((item) => {
        const isPapersItem = item.href === '/articles'

        const isPapersChild =
          isPapersItem && (pathname.startsWith('/articles/') || pathname.startsWith('/editorial'))

        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`) || isPapersChild

        const hasParent = isPapersChild

        const className = [isActive && 'is-active', hasParent && 'has-parent']
          .filter(Boolean)
          .join(' ')

        return (
          <a className={className} href={item.href} key={item.href}>
            {item.label}
          </a>
        )
      })}
    </>
  )
}
