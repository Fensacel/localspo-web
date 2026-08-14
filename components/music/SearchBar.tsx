'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Play, Plus, ListPlus, Loader2, MoreVertical } from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import { formatDuration } from '@/lib/utils/formatDuration'
import type { Track } from '@/types/track'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    track: Track
    x: number
    y: number
  } | null>(null)

  const router = useRouter()
  const { play, addToQueue, playNext } = usePlayerStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Live Instant Search with Debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      setOpen(false)
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    setLoading(true)
    setOpen(true)

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&type=songs`)
        const json = await res.json()
        const songs: Track[] = json.data?.songs || []
        const topResult: Track | null = json.data?.topResult?.data || null
        const combined = topResult ? [topResult, ...songs.filter((s) => s.id !== topResult.id)] : songs
        setResults(combined.slice(0, 6))
      } catch (err) {
        console.error('[SearchBar] Live search error:', err)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [query])

  // 2. Click Outside Listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setContextMenu(null)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setContextMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleSearchSubmit = useCallback(
    (q: string) => {
      if (q.trim()) {
        setOpen(false)
        setContextMenu(null)
        router.push(`/search?q=${encodeURIComponent(q.trim())}`)
      }
    },
    [router]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSearchSubmit(query)
    }
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setOpen(false)
    setContextMenu(null)
  }

  function handlePlayTrack(track: Track) {
    play(track, results.length > 0 ? results : [track], results.findIndex((t) => t.id === track.id))
    setOpen(false)
    setContextMenu(null)
  }

  function handleContextMenu(e: React.MouseEvent, track: Track) {
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    const x = e.clientX - (rect?.left || 0)
    const y = e.clientY - (rect?.top || 0)
    setContextMenu({ track, x: Math.min(x, 260), y: Math.min(y, 320) })
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (query.trim() && results.length > 0) setOpen(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search songs, artists, albums..."
        className="w-full bg-[#1a1a1a] border border-[#333] focus:border-blue-500 rounded-full pl-9 pr-8 py-1.5 text-sm text-white placeholder-gray-500 outline-none transition-colors shadow-inner"
        aria-label="Search"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}

      {/* Live Search Dropdown */}
      {open && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#121212]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 space-y-1 max-h-[380px] overflow-y-auto custom-scrollbar">
            {loading && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span>Searching...</span>
              </div>
            ) : results.length > 0 ? (
              <>
                <p className="text-[11px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider">
                  Top Results <span className="text-[10px] lowercase text-gray-500">(Right click for options)</span>
                </p>
                {results.map((track) => {
                  const thumb = track.thumbnail ?? track.thumbnailUrl
                  const artistName = typeof track.artist === 'string' ? track.artist : track.artist?.name || 'Unknown Artist'

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      onContextMenu={(e) => handleContextMenu(e, track)}
                      className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-white/10 cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-[#242424] shrink-0">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={track.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">♪</div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play size={14} fill="currentColor" className="text-white ml-0.5" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-blue-400 transition-colors">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">
                            {artistName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {track.duration && (
                          <span className="text-[11px] font-mono text-gray-500">
                            {formatDuration(track.duration)}
                          </span>
                        )}
                        <button
                          onClick={(e) => handleContextMenu(e, track)}
                          className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="More options"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              !loading && (
                <div className="text-center py-6 text-xs text-gray-400">
                  No direct matches found for &quot;{query}&quot;
                </div>
              )
            )}
          </div>

          {/* Footer: View All Results */}
          <div
            onClick={() => handleSearchSubmit(query)}
            className="border-t border-white/10 px-4 py-2.5 bg-white/5 hover:bg-white/10 cursor-pointer flex items-center justify-between text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>See all search results for &quot;{query}&quot;</span>
            <span>↵</span>
          </div>
        </div>
      )}

      {/* Right Click / Options Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu(null)
            }}
          />
          <div
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="absolute z-50 w-48 bg-[#181818]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          >
            <p className="text-[10px] font-bold text-gray-400 px-3 py-1 truncate uppercase tracking-wider border-b border-white/10">
              {contextMenu.track.title}
            </p>

            <button
              onClick={() => handlePlayTrack(contextMenu.track)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors"
            >
              <Play size={14} fill="currentColor" />
              <span>Putar Sekarang</span>
            </button>

            <button
              onClick={() => {
                addToQueue(contextMenu.track)
                setContextMenu(null)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Plus size={14} />
              <span>Tambah ke Antrean</span>
            </button>

            <button
              onClick={() => {
                playNext(contextMenu.track)
                setContextMenu(null)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ListPlus size={14} />
              <span>Putar Berikutnya</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
