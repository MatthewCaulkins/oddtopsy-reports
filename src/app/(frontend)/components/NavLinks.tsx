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
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}`)

        return (
          <a className={isActive ? 'is-active' : ''} href={item.href} key={item.href}>
            {item.label}
          </a>
        )
      })}
    </>
  )
}
