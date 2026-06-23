'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: '홈' },
  { href: '/meetings/new', label: '회의록 작성' },
  { href: '/meetings', label: '회의록 목록' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-20 bg-gradient-to-r from-sky-500 to-blue-600 shadow-md">
      <div className="mx-auto max-w-5xl px-4 flex items-center gap-1 sm:gap-3 h-14">
        <Link href="/" className="flex items-center gap-2 mr-2 shrink-0">
          <svg viewBox="0 0 40 40" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="20" cy="22" rx="14" ry="7" fill="#AADEEE" />
            <ellipse cx="31" cy="20" rx="7" ry="5.5" fill="#AADEEE" />
            <ellipse cx="37" cy="21" rx="3" ry="2" fill="#AADEEE" />
            <circle cx="33" cy="18.5" r="1" fill="#1A3A4A" />
            <path d="M20 16 Q23 9 26 15" fill="#7FCBE0" />
          </svg>
          <span className="font-bold text-white hidden sm:inline">돌고래</span>
        </Link>
        {links.map((link) => {
          const active =
            link.href === '/'
              ? pathname === '/'
              : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-white text-blue-600'
                  : 'text-blue-50 hover:bg-white/20'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
