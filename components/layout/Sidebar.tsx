'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Heart,
  Library,
  ChevronLeft,
  ChevronRight,
  Music,
  Volume2,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { usePlayerStore } from '@/store/playerStore'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/library', icon: Library, label: 'Library' },
  { href: '/liked', icon: Heart, label: 'Favorites' },
]

function SidebarPlaylistItem({
  pl,
  active,
  isPlayingThis,
  sidebarOpen,
  onClick,
}: {
  pl: { id: string; title: string; coverUrl?: string; trackCount: number }
  active: boolean
  isPlayingThis: boolean
  sidebarOpen: boolean
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <Link
      href={`/playlist/${pl.id}`}
      onClick={onClick}
      className={`flex items-center gap-3 p-2 rounded-xl transition-all group ${
        active
          ? 'bg-white/15 text-white'
          : 'hover:bg-white/10 text-gray-300 hover:text-white'
      } ${!sidebarOpen ? 'justify-center p-1.5' : ''}`}
      title={!sidebarOpen ? `${pl.title} (${pl.trackCount} tracks)` : undefined}
    >
      <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-[#242424] shadow-md">
        {pl.coverUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pl.coverUrl}
            alt={pl.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
            <Music size={16} />
          </div>
        )}

        {isPlayingThis && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
            <Volume2 size={16} className="text-[#38bdf8] animate-pulse" />
          </div>
        )}
      </div>

      {sidebarOpen && (
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold truncate leading-tight transition-colors ${
              isPlayingThis || active ? 'text-white' : 'text-gray-200 group-hover:text-white'
            }`}
          >
            {pl.title}
          </p>
          <p className="text-xs font-mono text-[#5883ad] tracking-tight truncate mt-0.5">
            {pl.trackCount} tracks
          </p>
        </div>
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar, setLyricsOpen } = useUIStore()
  const { playlists: localPlaylists } = usePlaylistStore()
  const { currentTrack, isPlaying, contextTitle } = usePlayerStore()
  const { user } = useAuthStore()

  const { data: serverPlaylists } = useQuery({
    queryKey: ['playlists'],
    queryFn: async () => {
      const res = await fetch('/api/playlists')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  // Combine local and server playlists
  const combinedPlaylists = [
    ...localPlaylists.map((pl) => ({
      id: pl.id,
      title: pl.name,
      coverUrl: pl.coverUrl,
      trackCount: pl.songs.length,
      isLocal: true,
    })),
    ...(serverPlaylists ?? [])
      .filter(
        (spl: { id: string; title?: string }) =>
          !localPlaylists.some(
            (lpl) =>
              lpl.id === spl.id ||
              lpl.name.toLowerCase().trim() === spl.title?.toLowerCase().trim()
          )
      )
      .map((spl: { id: string; title: string; cover_url?: string; coverUrl?: string; playlist_tracks?: { count?: number }[]; tracks?: unknown[] }) => {
        const count = Array.isArray(spl.playlist_tracks)
          ? spl.playlist_tracks[0]?.count ?? spl.playlist_tracks.length
          : spl.tracks?.length ?? 0
        return {
          id: spl.id,
          title: spl.title,
          coverUrl: spl.cover_url || spl.coverUrl,
          trackCount: count,
          isLocal: false,
        }
      }),
  ]

  return (
    <aside
      className={`fixed left-6 top-6 bottom-[108px] hidden md:flex flex-col bg-[#141414]/80 backdrop-blur-2xl border border-white/10 rounded-2xl z-40 transition-all duration-300 shadow-2xl overflow-hidden ${
        sidebarOpen ? 'w-64 p-4' : 'w-20 p-3'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between mb-5 px-1 shrink-0">
        <Link
          href="/"
          onClick={() => setLyricsOpen(false)}
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center p-1.5 shrink-0 shadow-lg shadow-white/5 group-hover:scale-105 transition-transform">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="LocalSpo"
              className="w-full h-full object-contain filter drop-shadow"
            />
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
          className="mx-auto mb-3 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Main Navigation */}
      <nav className="space-y-1 shrink-0 mb-3">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setLyricsOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-white text-black font-semibold shadow-lg shadow-white/5'
                  : 'text-[#c4c7c8] hover:text-white hover:bg-white/10'
              } ${!sidebarOpen ? 'justify-center px-0' : ''}`}
              title={!sidebarOpen ? label : undefined}
              aria-label={label}
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Playlists Divider */}
      {combinedPlaylists.length > 0 && (
        <div className="my-2 border-t border-white/10 shrink-0" />
      )}

      {/* Playlists List Section */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
        {combinedPlaylists.map((pl) => {
          const active = pathname === `/playlist/${pl.id}`
          const isPlayingThis =
            isPlaying &&
            (contextTitle === pl.title ||
              (pl.isLocal &&
                localPlaylists
                  .find((l) => l.id === pl.id)
                  ?.songs.some((s) => s.id === currentTrack?.id)))

          return (
            <SidebarPlaylistItem
              key={pl.id}
              pl={pl}
              active={active}
              isPlayingThis={isPlayingThis}
              sidebarOpen={sidebarOpen}
              onClick={() => setLyricsOpen(false)}
            />
          )
        })}
      </div>
    </aside>
  )
}
