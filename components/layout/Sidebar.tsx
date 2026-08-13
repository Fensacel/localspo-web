'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Search,
  Heart,
  Library,
  ListMusic,
  ChevronLeft,
  ChevronRight,
  Disc,
  Download,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useState } from 'react'
import { ImportPlaylistModal } from '@/components/playlist/ImportPlaylistModal'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Explore' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/library', icon: Library, label: 'Library' },
  { href: '/liked', icon: Heart, label: 'Favorites' },
  { href: '/queue', icon: ListMusic, label: 'Queue' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const [importing, setImporting] = useState(false)

  return (
    <aside
      className={`fixed left-6 top-6 bottom-[108px] hidden md:flex flex-col bg-[#141414]/80 backdrop-blur-2xl border border-white/10 rounded-2xl z-40 transition-all duration-300 shadow-2xl overflow-hidden ${
        sidebarOpen ? 'w-64 p-4' : 'w-20 p-3'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between mb-6 px-1">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-black text-xl shrink-0 shadow-lg shadow-white/10">
            <Disc className="w-6 h-6 text-black animate-spin-slow" />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-lg tracking-tight text-white truncate">
              LOCALSPО
            </span>
          )}
        </Link>

        {sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="mx-auto mb-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-white text-black font-semibold shadow-lg shadow-white/5'
                  : 'text-[#c4c7c8] hover:text-white hover:bg-white/10'
              } ${!sidebarOpen ? 'justify-center px-0' : ''}`}
              title={!sidebarOpen ? label : undefined}
              aria-label={label}
            >
              <Icon size={19} className="shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </Link>
          )
        })}

        <button
          onClick={() => setImporting(true)}
          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all text-green-400 hover:bg-green-500/10 border border-green-500/20 ${
            !sidebarOpen ? 'justify-center px-0' : ''
          }`}
          title={!sidebarOpen ? 'Import Spotify' : undefined}
        >
          <Download size={19} className="shrink-0 text-green-400" />
          {sidebarOpen && <span className="truncate">Import Spotify</span>}
        </button>
      </nav>

      <ImportPlaylistModal
        isOpen={importing}
        onClose={() => setImporting(false)}
      />

      {/* Footer Branding Info */}
      {sidebarOpen && (
        <div className="pt-4 border-t border-white/10 px-2 text-xs text-[#8e9192]">
          <p className="font-semibold text-white/80">LocalSpo Web</p>
          <p className="text-[10px] mt-0.5">Obsidian Music Player</p>
        </div>
      )}
    </aside>
  )
}
