'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrackRow } from '@/components/music/TrackRow'
import { AlbumCard } from '@/components/music/AlbumCard'
import { ArtistCard } from '@/components/music/ArtistCard'
import { usePlayerStore } from '@/store/playerStore'
import { TrackContextMenu } from '@/components/music/TrackContextMenu'
import { Search, X, Loader2, Compass, Music, Clock, Flame, Sparkles } from 'lucide-react'
import { Track } from '@/types/track'
import { Album } from '@/types/album'
import { Artist } from '@/types/artist'

const RECENT_SEARCH_KEY = 'localspo_recent_searches'
const MAX_RECENT = 8

type Tab = 'all' | 'songs' | 'artists' | 'albums'

interface SearchData {
  songs?: Track[]
  artists?: Artist[]
  albums?: Album[]
}

const BROWSE_GENRES = [
  { name: 'K-Pop', color: 'from-fuchsia-600 to-purple-800', query: 'K-Pop 2026 hits' },
  { name: 'Pop Hits', color: 'from-pink-600 to-rose-800', query: 'Top Pop Hits' },
  { name: 'Indonesian Pop', color: 'from-blue-600 to-sky-800', query: 'Top Indonesian Hits' },
  { name: 'Hip-Hop & R&B', color: 'from-amber-600 to-orange-800', query: 'Hip-Hop R&B' },
  { name: 'Rock & Alternative', color: 'from-red-700 to-rose-900', query: 'Rock hits' },
  { name: 'Anime & J-Pop', color: 'from-indigo-600 to-violet-800', query: 'Anime openings J-Pop' },
  { name: 'Chill & Acoustic', color: 'from-teal-600 to-emerald-800', query: 'Chill Acoustic Vibes' },
  { name: 'Gaming & Electronic', color: 'from-cyan-600 to-blue-800', query: 'EDM Electronic' },
]

export function SearchPage() {
  const params = useSearchParams()
  const router = useRouter()
  const urlQ = params.get('q') ?? ''

  const [inputQuery, setInputQuery] = useState(urlQ)
  const [tab, setTab] = useState<Tab>('all')
  const [contextMenu, setContextMenu] = useState<{ track: Track; position: { x: number; y: number } } | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const { play } = usePlayerStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCH_KEY)
      if (saved) setRecentSearches(JSON.parse(saved))
    } catch {}
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const saveRecentSearch = useCallback((query: string) => {
    const q = query.trim()
    if (!q) return
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== q.toLowerCase())
      const next = [q, ...filtered].slice(0, MAX_RECENT)
      try { localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== query)
      try { localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const clearAllRecentSearches = useCallback(() => {
    setRecentSearches([])
    try { localStorage.removeItem(RECENT_SEARCH_KEY) } catch {}
  }, [])

  // Sync state if URL changes
  useEffect(() => {
    setInputQuery(urlQ)
  }, [urlQ])

  // Real-time search query
  const activeQuery = inputQuery.trim()

  const { data, isLoading, error } = useQuery<SearchData>({
    queryKey: ['search', activeQuery],
    queryFn: async () => {
      if (!activeQuery) return {}
      const res = await fetch(`/api/search?q=${encodeURIComponent(activeQuery)}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Search failed')
      return json.data
    },
    enabled: activeQuery.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  function handleInputChange(val: string) {
    setInputQuery(val)
    setShowDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.trim()) {
        saveRecentSearch(val.trim())
        router.replace(`/search?q=${encodeURIComponent(val.trim())}`)
      } else {
        router.replace('/search')
      }
    }, 400)
  }

  function handleClear() {
    setInputQuery('')
    router.replace('/search')
    inputRef.current?.focus()
    setShowDropdown(true)
  }

  function handleGenreClick(genreQuery: string) {
    setInputQuery(genreQuery)
    saveRecentSearch(genreQuery)
    router.replace(`/search?q=${encodeURIComponent(genreQuery)}`)
    setShowDropdown(false)
  }

  function handleRecentClick(query: string) {
    setInputQuery(query)
    saveRecentSearch(query)
    router.replace(`/search?q=${encodeURIComponent(query)}`)
    setShowDropdown(false)
  }

  function handleInputFocus() {
    setShowDropdown(true)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputQuery.trim()) {
      saveRecentSearch(inputQuery.trim())
      setShowDropdown(false)
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      inputRef.current?.blur()
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'songs', label: 'Songs' },
    { id: 'artists', label: 'Artists' },
    { id: 'albums', label: 'Albums' },
  ]

  function handlePlaySong(track: Track) {
    const songs = data?.songs ?? []
    const idx = songs.findIndex((t) => t.id === track.id)
    play(track, songs, idx >= 0 ? idx : 0, `Search: "${activeQuery}"`)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-28 selection:bg-white/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
        {/* Page Title - only on mobile (desktop has TopBar) */}
        <h1 className="text-2xl font-black tracking-tight text-white mb-4 sm:hidden">Search</h1>

        {/* Search Input - mobile only (desktop uses TopBar SearchBar) */}
        <div className="relative mb-6 sm:hidden">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={handleInputKeyDown}
              placeholder="Search songs, artists, albums..."
              className="w-full bg-[#1a1a1a] text-white font-medium rounded-2xl pl-11 pr-11 py-3.5 text-sm placeholder:text-gray-500 shadow-xl outline-none focus:ring-2 focus:ring-[#0070f3] border border-white/10 focus:border-[#0070f3]/50 transition-all"
              aria-label="Search music"
              autoComplete="off"
            />
            {inputQuery && (
              <button
                onClick={handleClear}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white transition-colors z-10"
                aria-label="Hapus pencarian"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Recent Searches Dropdown */}
          {showDropdown && !inputQuery && recentSearches.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#161616] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pencarian Terakhir</span>
                <button
                  onClick={clearAllRecentSearches}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors font-medium"
                >
                  Hapus semua
                </button>
              </div>
              <div className="divide-y divide-white/5">
                {recentSearches.map((query) => (
                  <div
                    key={query}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => handleRecentClick(query)}
                    >
                      <Clock size={14} className="text-gray-500 shrink-0" />
                      <span className="text-sm text-gray-200 truncate">{query}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRecentSearch(query)
                      }}
                      className="ml-2 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      aria-label={`Hapus "${query}" dari riwayat`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CASE 1: EMPTY STATE -> SPOTIFY BROWSE ALL GENRES */}
        {!activeQuery ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Compass size={18} className="text-[#38bdf8]" />
              <h2 className="text-base font-bold text-white">Browse All</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {BROWSE_GENRES.map((genre) => (
                <div
                  key={genre.name}
                  onClick={() => handleGenreClick(genre.query)}
                  className={`cursor-pointer h-24 sm:h-28 rounded-2xl p-3 sm:p-4 bg-gradient-to-br ${genre.color} flex flex-col justify-between shadow-lg hover:scale-[1.02] active:scale-95 transition-all select-none relative overflow-hidden group`}
                >
                  <p className="font-extrabold text-sm sm:text-base text-white tracking-tight leading-tight">
                    {genre.name}
                  </p>
                  <div className="self-end opacity-40 group-hover:opacity-80 transition-opacity">
                    <Music size={24} className="text-white transform rotate-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* CASE 2: ACTIVE SEARCH RESULTS */
          <div>
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    tab === t.id
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-gray-300 hover:text-white border border-white/5'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Loading Spinner */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <Loader2 size={28} className="animate-spin text-[#38bdf8]" />
                <span className="text-xs font-medium">Searching &quot;{activeQuery}&quot;...</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="py-12 text-center text-red-400 text-sm">
                Terjadi kesalahan saat mencari lagu. Silakan coba lagi.
              </div>
            )}

            {/* Results */}
            {!isLoading && !error && data && (
              <div className="space-y-6">

                {/* Top Result Card */}
                {tab === 'all' && data.songs && data.songs.length > 0 && (() => {
                  const topTrack = data.songs[0]
                  const topThumb = topTrack.thumbnail ?? topTrack.thumbnailUrl
                  return (
                    <section>
                      <h2 className="text-sm font-extrabold text-white mb-3 uppercase tracking-widest">Top Result</h2>
                      <div
                        onClick={() => handlePlaySong(topTrack)}
                        className="group flex items-center gap-4 p-4 rounded-2xl bg-[#181818] hover:bg-[#222] transition-colors cursor-pointer relative border border-white/5"
                      >
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#2a2a2a] shadow-xl border border-white/10 shrink-0">
                          {topThumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={topThumb} alt={topTrack.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl text-gray-600">♪</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-black text-white truncate leading-tight">{topTrack.title}</p>
                          <p className="text-sm text-gray-400 font-medium truncate">
                            {typeof topTrack.artist === 'string' ? topTrack.artist : topTrack.artist?.name || 'Unknown'}
                            {topTrack.album?.name && <span className="ml-1">• {topTrack.album.name}</span>}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-[#38bdf8] text-black flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0">
                          <Sparkles size={16} />
                        </div>
                      </div>
                    </section>
                  )
                })()}

                {/* Songs — show ALL in both All and Songs tab */}
                {(tab === 'all' || tab === 'songs') && data.songs && data.songs.length > 0 && (
                  <section>
                    <h2 className="text-sm font-extrabold text-white mb-3 uppercase tracking-widest flex items-center gap-2">
                      <Flame size={14} className="text-[#38bdf8]" />
                      Songs
                      <span className="text-gray-500 font-normal text-xs">{data.songs.length}</span>
                    </h2>
                    <div className="space-y-1">
                      {data.songs.map((track, i) => (
                        <TrackRow
                          key={track.id || track.videoId || `song-${i}`}
                          track={track}
                          onPlay={() => handlePlaySong(track)}
                          showAlbum
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Artists — show ALL */}
                {(tab === 'all' || tab === 'artists') && data.artists && data.artists.length > 0 && (
                  <section>
                    <h2 className="text-sm font-extrabold text-white mb-3 uppercase tracking-widest">
                      Artists
                      <span className="text-gray-500 font-normal text-xs ml-2">{data.artists.length}</span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {data.artists.map((artist, i) => (
                        <ArtistCard
                          key={artist.id || `artist-${i}`}
                          name={artist.name}
                          imageUrl={artist.thumbnail}
                          onClick={() => router.push(`/artist/${artist.id}`)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Albums — show ALL */}
                {(tab === 'all' || tab === 'albums') && data.albums && data.albums.length > 0 && (
                  <section>
                    <h2 className="text-sm font-extrabold text-white mb-3 uppercase tracking-widest">
                      Albums
                      <span className="text-gray-500 font-normal text-xs ml-2">{data.albums.length}</span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {data.albums.map((album, i) => (
                        <AlbumCard
                          key={album.id || `album-${i}`}
                          title={album.title}
                          subtitle={album.artist?.name}
                          imageUrl={album.thumbnail}
                          onClick={() => router.push(`/album/${album.id}`)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* No results */}
                {!data.songs?.length && !data.artists?.length && !data.albums?.length && (
                  <div className="text-center py-16 text-gray-400 space-y-2">
                    <p className="text-base font-bold text-white">Tidak ada hasil untuk &quot;{activeQuery}&quot;</p>
                    <p className="text-xs">Coba periksa ejaan atau gunakan kata kunci lain.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Context Menu Modal */}
      {contextMenu && (
        <TrackContextMenu
          track={contextMenu.track}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

