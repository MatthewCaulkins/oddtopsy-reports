'use client'

import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/articles', label: 'Papers' },
  { href: '/submit', label: 'Submit' },
  { href: '/about', label: 'About' },
  { href: '/subscribe', label: 'Subscribe' },
]

function getEditorialParent(pathname: string) {
  if (pathname.startsWith('/editorial/submissions/')) {
    return '/articles'
  }

  if (pathname.startsWith('/editorial/pages/papers')) {
    return '/articles'
  }

  if (pathname.startsWith('/editorial/pages/submit')) {
    return '/submit'
  }

  if (pathname.startsWith('/editorial/pages/about')) {
    return '/about'
  }

  if (pathname.startsWith('/editorial/pages/subscribe')) {
    return '/subscribe'
  }

  return null
}

export function NavLinks() {
  const pathname = usePathname()
  const editorialParent = getEditorialParent(pathname)

  return (
    <>
      {navItems.map((item) => {
        const isDirectActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

        const isEditorialChild = editorialParent === item.href

        const isActive = isDirectActive || isEditorialChild

        const className = [isActive && 'is-active', isEditorialChild && 'has-parent']
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
