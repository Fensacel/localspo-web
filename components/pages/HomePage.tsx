'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { TrackRow } from '@/components/music/TrackRow'
import { AlbumCard } from '@/components/music/AlbumCard'
import { Track } from '@/types/track'
import { usePlayerStore } from '@/store/playerStore'

export function HomePage() {
  const { user } = useAuthStore()
  const { play } = usePlayerStore()
  const [filter, setFilter] = useState<'all' | 'music' | 'podcast'>('all')

  const { data: trending } = useQuery<Track[]>({
    queryKey: ['trending'],
    queryFn: async () => {
      const res = await fetch('/api/search?q=trending+music+2024&type=songs')
      const json = await res.json()
      return json.data?.songs ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: history } = useQuery<Track[]>({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch('/api/history')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  function handlePlay(track: Track, tracks: Track[]) {
    const idx = tracks.findIndex((t) => t.id === track.id)
    const queue = idx >= 0 ? tracks.slice(idx) : [track]
    play(track, queue)
  }

  const quickPickTracks = trending ? trending.slice(0, 8) : []

  return (
    <div className="flex-1 space-y-10 pb-12" suppressHydrationWarning>
      {/* Category Pills & Quick Access Grid */}
      <div className="space-y-4" suppressHydrationWarning>
        {/* Category Pills */}
        <div className="flex items-center gap-2" suppressHydrationWarning>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-white text-black shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilter('music')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === 'music'
                ? 'bg-white text-black shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
            }`}
          >
            Musik
          </button>
          <button
            onClick={() => setFilter('podcast')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === 'podcast'
                ? 'bg-white text-black shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
            }`}
          >
            Podcast
          </button>
        </div>

        {/* Quick Access Cards */}
        {quickPickTracks.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickPickTracks.map((track) => {
              const thumb = track.thumbnail ?? track.thumbnailUrl
              return (
                <div
                  key={track.id}
                  onClick={() => handlePlay(track, quickPickTracks)}
                  className="flex items-center bg-[#131313]/60 hover:bg-[#1f1f1f] border border-white/10 rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 shadow-md"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={track.title}
                      className="w-16 h-16 object-cover shadow-md shrink-0 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-white/10 flex items-center justify-center shrink-0">
                      <span className="text-white/40 text-xs">♪</span>
                    </div>
                  )}
                  <span className="px-4 text-xs font-semibold text-white truncate flex-1">
                    {track.title}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recently Played */}
      {user && history && history.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Recently Played</h2>
          </div>
          <div className="bg-[#131313]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-1 shadow-xl">
            {history.slice(0, 8).map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                onPlay={() => handlePlay(track, history)}
                showAlbum
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending Now */}
      {trending && trending.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Inilah New Music Friday!</h2>
            <button className="text-xs font-semibold text-gray-400 hover:text-white uppercase tracking-wider transition-colors">
              Tampilkan semua
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {trending.slice(0, 10).map((track) => (
              <AlbumCard
                key={track.id}
                title={track.title}
                subtitle={track.artist?.name ?? ''}
                imageUrl={track.thumbnail ?? track.thumbnailUrl}
                onClick={() => handlePlay(track, trending)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Quick Picks / Recommended */}
      {trending && trending.length > 10 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Made For You</h2>
          </div>
          <div className="bg-[#131313]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-1 shadow-xl">
            {trending.slice(10, 18).map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                onPlay={() => handlePlay(track, trending.slice(10))}
                showAlbum
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
