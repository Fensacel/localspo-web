'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { UserMenu } from '../auth/UserMenu'
import { SearchBar } from '../music/SearchBar'

export function TopBar() {
  const router = useRouter()

  return (
    <header className="sticky top-0 h-16 w-full z-30 bg-[#050505]/75 backdrop-blur-xl flex items-center justify-between px-6 mb-2">
      {/* Navigation controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all shadow"
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => router.forward()}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all shadow"
          aria-label="Go forward"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Search bar */}
      <div className="flex-1 max-w-lg mx-6">
        <SearchBar />
      </div>

      {/* User menu */}
      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  )
}
