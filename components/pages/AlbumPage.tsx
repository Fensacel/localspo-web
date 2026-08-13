'use client'

import { useQuery } from '@tanstack/react-query'
import { Play, Pause, Shuffle } from 'lucide-react'
import { TrackRow } from '@/components/music/TrackRow'
import { usePlayerStore } from '@/store/playerStore'
import { formatDuration } from '@/lib/utils/formatDuration'
import { useState } from 'react'
import { Track } from '@/types/track'

interface AlbumPageProps {
  id: string
}

export function AlbumPage({ id }: AlbumPageProps) {
  const { play, shuffle, toggleShuffle, pause, isPlaying, currentTrack, queue, contextTitle } =
    usePlayerStore()
  const [imgError, setImgError] = useState(false)

  const { data: album, isLoading, error } = useQuery({
    queryKey: ['album', id],
    queryFn: async () => {
      const res = await fetch(`/api/albums/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load album')
      return json.data
    },
    staleTime: 10 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <span className="animate-pulse">Loading album…</span>
      </div>
    )
  }

  if (error || !album) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400">
        Failed to load album.
      </div>
    )
  }

  const tracks: Track[] = album.tracks ?? []
  const totalDuration = tracks.reduce((acc: number, t: Track) => acc + (t.duration ?? 0), 0)

  function handlePlay(track: Track, index: number) {
    play(track, tracks, index, album.title)
  }

  function handlePlayAll() {
    if (tracks.length > 0) play(tracks[0], tracks, 0, album.title)
  }

  function handleShuffle() {
    toggleShuffle()
    const state = usePlayerStore.getState()
    const isThisAlbumPlaying = state.queue.length > 0 && tracks.some((t) => t.id === state.currentTrack?.id)
    if (!isThisAlbumPlaying && tracks.length > 0) {
      const randomIndex = Math.floor(Math.random() * tracks.length)
      play(tracks[randomIndex], tracks, randomIndex, album.title)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto pb-28">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 to-[#0a0a0a]" />
        <div className="relative px-6 pt-8 pb-6 flex items-end gap-6">
          <div className="w-44 h-44 shrink-0 rounded-lg overflow-hidden bg-[#2a2a2a] shadow-2xl">
            {album.thumbnail && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={album.thumbnail}
                alt={album.title}
                className="object-cover w-full h-full"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-gray-700">♪</div>
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Album</p>
            <h1 className="text-3xl font-bold truncate">{album.title}</h1>
            <p className="text-gray-300">{album.artist?.name}</p>
            <p className="text-sm text-gray-500">
              {album.year && `${album.year} · `}
              {tracks.length} tracks · {formatDuration(totalDuration)}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      {(() => {
        const isThisAlbumPlaying =
          isPlaying &&
          queue.length > 0 &&
          (contextTitle === album.title || tracks.some((t) => t.id === currentTrack?.id))

        return (
          <div className="px-6 pb-4 flex items-center gap-3">
            <button
              onClick={isThisAlbumPlaying ? pause : handlePlayAll}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-medium transition-colors"
            >
              {isThisAlbumPlaying ? (
                <>
                  <Pause size={16} fill="currentColor" /> Pause
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" /> Play
                </>
              )}
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
        )
      })()}

      {/* Track list */}
      <div className="px-4 pb-8">
        {tracks.length === 0 ? (
          <p className="text-gray-400 px-2 py-4">No tracks available.</p>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id ?? i}
                track={track}
                index={i + 1}
                onPlay={() => handlePlay(track, i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
