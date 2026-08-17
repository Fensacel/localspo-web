'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlayerStore } from '@/store/playerStore'
import { useUIStore } from '@/store/uiStore'
import { romanizeText } from '@/lib/lyrics/romanizer'
import type { LyricLine } from '@/types/lyrics'
import { Languages } from 'lucide-react'

export function LyricsPanel() {
  const { currentTrack, currentTime, seek } = usePlayerStore()
  const { lyricsMode, toggleLyricsMode } = useUIStore()
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
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 right-6 z-20 flex items-center gap-2">
        <button
          onClick={toggleLyricsMode}
          title={
            lyricsMode === 'original'
              ? 'Tampilkan Romanisasi / Romaji'
              : 'Sembunyikan Romanisasi / Romaji'
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all shadow-md ${
            lyricsMode === 'romanized'
              ? 'bg-blue-600 text-white shadow-blue-500/20'
              : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{lyricsMode === 'romanized' ? 'Romaji On' : 'Romaji Off'}</span>
        </button>
      </div>

      {/* Synced Lyrics List */}
      {isSynced && lines.length > 0 ? (
        <div
          ref={containerRef}
          className="h-full overflow-y-auto px-6 py-24 space-y-5 scroll-smooth custom-scrollbar no-scrollbar text-left"
        >
          {lines.map((line, i) => {
            const isActive = i === activeIdx
            const hasRomajiSub =
              lyricsMode === 'romanized' &&
              Boolean(line.romanizedText) &&
              line.romanizedText !== line.text

            return (
              <button
                key={i}
                ref={isActive ? activeRef : null}
                onClick={() => seek(line.time)}
                className={`block w-full text-left tracking-tight leading-snug transition-all duration-200 py-1 group ${
                  isActive
                    ? 'opacity-100'
                    : 'opacity-50 hover:opacity-80'
                }`}
              >
                {/* Main Lyric Line (Original Text: Big & Bold) */}
                <div
                  className={`text-xl sm:text-2xl font-black ${
                    isActive ? 'text-white' : 'text-white/70'
                  }`}
                >
                  {line.text || ' '}
                </div>

                {/* Sub Romaji Line (Small, underneath main line, as in Spotify/LocalSpo design) */}
                {hasRomajiSub && (
                  <div
                    className={`text-sm sm:text-base font-semibold mt-1 transition-opacity ${
                      isActive ? 'text-white/70' : 'text-white/40'
                    }`}
                  >
                    {line.romanizedText}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ) : plainText ? (
        <div className="h-full overflow-y-auto px-6 py-16 text-left">
          {lyricsMode === 'romanized' ? (
            <div className="space-y-4 font-sans">
              {plainText.split('\n').map((rawLine, idx) => {
                const rom = romanizeText(rawLine)
                const showSub = rom && rom !== rawLine
                return (
                  <div key={idx} className="py-0.5">
                    <div className="text-white/90 text-base sm:text-lg font-bold">
                      {rawLine}
                    </div>
                    {showSub && (
                      <div className="text-white/50 text-sm sm:text-base font-medium mt-0.5">
                        {rom}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <pre className="text-white/80 text-base sm:text-lg font-bold leading-relaxed whitespace-pre-wrap font-sans">
              {plainText}
            </pre>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-500 text-sm">
          Lirik tidak tersedia
        </div>
      )}
    </div>
  )
}
