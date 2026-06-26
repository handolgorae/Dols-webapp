'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

const links = [
  { href: '/', label: '홈' },
  { href: '/meetings/new', label: '회의록 작성' },
  { href: '/meetings', label: '회의록 목록' },
  { href: '/test', label: '시스템 상태' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-20 bg-gradient-to-r from-sky-500 to-blue-600 shadow-md">
      <div className="mx-auto max-w-5xl px-4 flex items-center gap-1 sm:gap-2 h-14">
        {/* 로고 */}
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

        {/* 메뉴 링크 */}
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 overflow-x-auto">
          {links.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
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

        {/* 로그아웃 */}
        <form action={logout} className="shrink-0 ml-1">
          <button
            type="submit"
            className="px-2.5 py-1.5 rounded-full text-xs sm:text-sm text-blue-100 border border-blue-300/50 hover:bg-white/20 transition-colors whitespace-nowrap"
          >
            로그아웃
          </button>
        </form>
      </div>
    </nav>
  )
}
