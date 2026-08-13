'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePlayerStore } from '@/store/playerStore'
import type { LyricLine } from '@/types/lyrics'

export function LyricsPanel() {
  const { currentTrack, currentTime, seek } = usePlayerStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  const { data: lyricsData, isLoading } = useQuery({
    queryKey: ['lyrics', currentTrack?.id],
    queryFn: async ({ signal }) => {
      if (!currentTrack) return null
      const params = new URLSearchParams({
        artist: currentTrack.artist?.name ?? '',
        track: currentTrack.title,
        album: currentTrack.album?.name ?? '',
        duration: String(currentTrack.duration ?? 0),
      })
      const res = await fetch(`/api/lyrics?${params}`, { signal })
      const json = await res.json()
      if (!json.success) return null
      return { ...json.data, trackId: currentTrack.id }
    },
    enabled: !!currentTrack,
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
      <div className="h-full flex items-center justify-center text-gray-500 text-sm animate-pulse">
        Loading lyrics…
      </div>
    )
  }

  if (!lyricsData || (!isSynced && !plainText)) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Lyrics unavailable
      </div>
    )
  }

  if (isSynced && lines.length > 0) {
    return (
      <div ref={containerRef} className="h-full overflow-y-auto px-8 py-12 space-y-6 scroll-smooth">
        {lines.map((line, i) => {
          const isActive = i === activeIdx
          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              onClick={() => seek(line.time)}
              className={`block w-full text-left text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight leading-snug transition-all duration-300 rounded-lg px-3 py-2 ${
                isActive
                  ? 'text-white scale-[1.02] origin-left opacity-100 drop-shadow-md'
                  : 'text-gray-500/70 hover:text-gray-200 opacity-60 hover:opacity-90'
              }`}
            >
              {line.text || ' '}
            </button>
          )
        })}
      </div>
    )
  }

  if (plainText) {
    return (
      <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto">
        <pre className="text-gray-300 text-xl font-bold leading-relaxed whitespace-pre-wrap font-sans">
          {plainText}
        </pre>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
      Lyrics unavailable
    </div>
  )
}
