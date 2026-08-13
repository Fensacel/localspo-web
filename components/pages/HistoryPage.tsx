'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePlayerStore } from '@/store/playerStore'
import { TrackRow } from '@/components/music/TrackRow'
import { Track } from '@/types/track'
import { useEffect, useState } from 'react'

export function HistoryPage() {
  const { user } = useAuthStore()
  const { play } = usePlayerStore()
  const [localHistory, setLocalHistory] = useState<Track[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('localspo_history')
      if (stored) {
        setLocalHistory(JSON.parse(stored))
      }
    } catch {}
  }, [])

  const { data: apiTracks, isLoading } = useQuery<Track[]>({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch('/api/history')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })

  if (isLoading && !localHistory.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
        Loading history…
      </div>
    )
  }

  // Merge API tracks with local history (prefer API when logged in)
  const tracksMap = new Map<string, Track>()
  const rawList = user && apiTracks && apiTracks.length > 0 ? apiTracks : localHistory
  rawList.forEach((t) => {
    if (t?.id && !tracksMap.has(t.id)) {
      tracksMap.set(t.id, t)
    }
  })
  const list = Array.from(tracksMap.values())

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">Recently Played</h1>
          <span className="text-xs text-gray-400 font-mono">{list.length} tracks</span>
        </div>

        {list.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl border border-white/5">
            <p className="text-gray-400 text-sm">No listening history yet.</p>
            <p className="text-xs text-gray-500 mt-1">Play any track for at least 10 seconds to record history.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((track, i) => (
              <TrackRow
                key={`${track.id}-${i}`}
                track={track}
                onPlay={() => play(track, list.slice(i))}
                showAlbum
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
