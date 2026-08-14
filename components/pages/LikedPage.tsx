'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePlayerStore } from '@/store/playerStore'
import { TrackRow } from '@/components/music/TrackRow'
import { Play, Shuffle } from 'lucide-react'
import { Track } from '@/types/track'

export function LikedPage() {
  const { user, initialized } = useAuthStore()
  const { play, shuffle, toggleShuffle } = usePlayerStore()

  const { data: tracks, isLoading } = useQuery<Track[]>({
    queryKey: ['liked', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/liked')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })

  if (!initialized) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
        Loading liked songs…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Sign in to see your liked songs.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
        Loading liked songs…
      </div>
    )
  }

  const list = tracks ?? []

  function handlePlay(track: Track, i: number) {
    play(track, list, i, 'Lagu yang Disukai')
  }

  function handleShuffle() {
    toggleShuffle()
    const state = usePlayerStore.getState()
    const isThisListPlaying = state.queue.length > 0 && list.some((t) => t.id === state.currentTrack?.id)
    if (!isThisListPlaying && list.length > 0) {
      const randomIndex = Math.floor(Math.random() * list.length)
      play(list[randomIndex], list, randomIndex, 'Lagu yang Disukai')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 pb-28">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center text-6xl shadow-xl">
            ♥
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Playlist</p>
            <h1 className="text-4xl font-bold">Liked Songs</h1>
            <p className="text-gray-400 mt-2">{list.length} songs</p>
          </div>
        </div>

        {list.length > 0 && (
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => list.length > 0 && play(list[0], list)}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-medium transition-colors"
            >
              <Play size={16} fill="currentColor" /> Play
            </button>
            <button
              onClick={handleShuffle}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                shuffle
                  ? 'bg-white/10 hover:bg-white/20 border border-white/20 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white'
              }`}
            >
              <Shuffle size={14} className={shuffle ? 'text-white' : 'text-gray-400'} />
              <span>Shuffle</span>
            </button>
          </div>
        )}

        {list.length === 0 ? (
          <p className="text-gray-400">You haven&apos;t liked any songs yet. Start listening!</p>
        ) : (
          <div className="space-y-1">
            {list.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                onPlay={() => handlePlay(track, i)}
                showAlbum
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
