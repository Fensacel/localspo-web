'use client'

import Link from 'next/navigation'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Search, Library, User } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/library', icon: Library, label: 'Library' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { setLyricsOpen } = useUIStore()

  // Hide on full /now-playing screen
  if (pathname === '/now-playing') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[#0a0a0a]/95 backdrop-blur-2xl border-t border-white/10 pb-[env(safe-area-inset-bottom,8px)] pt-2 px-3 shadow-2xl">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href || (href !== '/' && pathname.startsWith(href))

          return (
            <button
              key={href}
              onClick={() => {
                setLyricsOpen(false)
                router.push(href)
              }}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl active:scale-90 transition-all duration-200 ${
                active
                  ? 'text-white scale-105'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon
                size={20}
                className={active ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'text-gray-400'}
              />
              <span className={`text-[10px] font-medium tracking-tight ${active ? 'font-bold text-white' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
