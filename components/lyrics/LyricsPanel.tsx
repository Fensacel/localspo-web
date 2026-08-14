'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlayerStore } from '@/store/playerStore'
import type { LyricLine } from '@/types/lyrics'

export function LyricsPanel() {
  const { currentTrack, currentTime, seek } = usePlayerStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  const artistName =
    typeof currentTrack?.artist === 'string'
      ? currentTrack.artist
      : currentTrack?.artist?.name ?? ''

  const albumName =
    typeof currentTrack?.album === 'string'
      ? currentTrack.album
      : currentTrack?.album?.name ?? ''

  const { data: lyricsData, isLoading } = useQuery({
    queryKey: ['lyrics', currentTrack?.id, currentTrack?.title, artistName],
    queryFn: async ({ signal }) => {
      if (!currentTrack) return null
      const params = new URLSearchParams({
        artist: artistName,
        track: currentTrack.title,
        album: albumName,
        duration: String(currentTrack.duration ?? 0),
      })
      const res = await fetch(`/api/lyrics?${params}`, { signal })
      const json = await res.json()
      if (!json.success) return null
      return { ...json.data, trackId: currentTrack.id }
    },
    enabled: Boolean(currentTrack && (artistName || currentTrack.title)),
    staleTime: 30 * 60 * 1000,
  })

  const isSynced = Boolean(lyricsData?.synced && Array.isArray(lyricsData?.lines) && lyricsData.lines.length > 0)
  const lines: LyricLine[] = isSynced ? (lyricsData?.lines as LyricLine[]) : []
  const plainText: string = lyricsData?.plain ?? lyricsData?.plainLyrics ?? ''

  // Find active line index matching current playback position
  let activeIdx = -1
  if (isSynced && lines.length > 0) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].time <= currentTime) {
        activeIdx = i
        break
      }
    }
  }

  // Auto-scroll active line smoothly into center view
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeIdx])

  if (!currentTrack) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        No track selected
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm animate-pulse">
        Memuat lirik…
      </div>
    )
  }

  if (!lyricsData || (!isSynced && !plainText)) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Lirik tidak tersedia untuk lagu ini
      </div>
    )
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Synced Lyrics List (Left-aligned & Bold matching Spotify screenshot) */}
      {isSynced && lines.length > 0 ? (
        <div
          ref={containerRef}
          className="h-full overflow-y-auto px-6 py-24 space-y-3.5 scroll-smooth custom-scrollbar no-scrollbar text-left"
        >
          {lines.map((line, i) => {
            const isActive = i === activeIdx
            return (
              <button
                key={i}
                ref={isActive ? activeRef : null}
                onClick={() => seek(line.time)}
                className={`block w-full text-left tracking-tight leading-snug transition-all duration-200 py-1 ${
                  isActive
                    ? 'text-xl sm:text-2xl font-black text-white opacity-100'
                    : 'text-base sm:text-lg font-bold text-white/50 hover:text-white/80'
                }`}
              >
                {line.text || ' '}
              </button>
            )
          })}
        </div>
      ) : plainText ? (
        <div className="h-full overflow-y-auto px-6 py-16 text-left">
          <pre className="text-white/80 text-base sm:text-lg font-bold leading-relaxed whitespace-pre-wrap font-sans">
            {plainText}
          </pre>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-500 text-sm">
          Lirik tidak tersedia
        </div>
      )}
    </div>
  )
}
