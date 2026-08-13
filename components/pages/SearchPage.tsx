'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrackRow } from '@/components/music/TrackRow'
import { AlbumCard } from '@/components/music/AlbumCard'
import { ArtistCard } from '@/components/music/ArtistCard'
import { PlaylistCard } from '@/components/music/PlaylistCard'
import { usePlayerStore } from '@/store/playerStore'
import { Track } from '@/types/track'
import { Album } from '@/types/album'
import { Artist } from '@/types/artist'

type Tab = 'all' | 'songs' | 'artists' | 'albums' | 'playlists'

interface SearchData {
  songs?: Track[]
  artists?: Artist[]
  albums?: Album[]
  playlists?: unknown[]
}

export function SearchPage() {
  const params = useSearchParams()
  const router = useRouter()
  const q = params.get('q') ?? ''
  const [tab, setTab] = useState<Tab>('all')
  const { play } = usePlayerStore()

  const { data, isLoading, error } = useQuery<SearchData>({
    queryKey: ['search', q],
    queryFn: async () => {
      if (!q.trim()) return {}
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Search failed')
      return json.data
    },
    enabled: q.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'songs', label: 'Songs' },
    { id: 'artists', label: 'Artists' },
    { id: 'albums', label: 'Albums' },
    { id: 'playlists', label: 'Playlists' },
  ]

  function handlePlaySong(track: Track) {
    const songs = data?.songs ?? []
    const idx = songs.findIndex((t) => t.id === track.id)
    play(track, songs, idx >= 0 ? idx : 0)
  }

  if (!q) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Search</h1>
          <p className="text-gray-400">What do you want to listen to?</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-bold mb-4">Results for &quot;{q}&quot;</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <span className="animate-pulse">Searching…</span>
          </div>
        )}

        {error && (
          <div className="py-8 text-red-400">Something went wrong. Please try again.</div>
        )}

        {!isLoading && !error && data && (
          <div className="space-y-10">
            {/* Songs */}
            {(tab === 'all' || tab === 'songs') && data.songs && data.songs.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Songs</h2>
                <div className="space-y-1">
                  {(tab === 'songs' ? data.songs : data.songs.slice(0, 5)).map((track, i) => (
                    <TrackRow
                      key={track.id || track.videoId || `song-${i}`}
                      track={track}
                      index={i + 1}
                      onPlay={() => handlePlaySong(track)}
                      showAlbum
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Artists */}
            {(tab === 'all' || tab === 'artists') && data.artists && data.artists.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Artists</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {(tab === 'artists' ? data.artists : data.artists.slice(0, 5)).map((artist, i) => (
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

            {/* Albums */}
            {(tab === 'all' || tab === 'albums') && data.albums && data.albums.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Albums</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {(tab === 'albums' ? data.albums : data.albums.slice(0, 5)).map((album, i) => (
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

            {!data.songs?.length && !data.artists?.length && !data.albums?.length && (
              <p className="text-gray-400 py-8">No results found for &quot;{q}&quot;</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
