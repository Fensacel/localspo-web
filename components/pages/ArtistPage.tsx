'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { TrackRow } from '@/components/music/TrackRow'
import { AlbumCard } from '@/components/music/AlbumCard'
import { usePlayerStore } from '@/store/playerStore'
import { useState } from 'react'
import { Track } from '@/types/track'
import { Album } from '@/types/album'
import { Play, CheckCircle2, UserPlus, MoreHorizontal } from 'lucide-react'

interface ArtistPageProps {
  id: string
}

export function ArtistPage({ id }: ArtistPageProps) {
  const { play } = usePlayerStore()
  const router = useRouter()
  const [imgError, setImgError] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)

  const { data: artist, isLoading, error } = useQuery({
    queryKey: ['artist', id],
    queryFn: async () => {
      const res = await fetch(`/api/artists/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load artist')
      return json.data
    },
    staleTime: 10 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 py-20">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-white animate-ping" />
          <span className="text-sm font-medium">Loading artist...</span>
        </div>
      </div>
    )
  }

  if (error || !artist) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400 py-20">
        Failed to load artist details.
      </div>
    )
  }

  const songs: Track[] = artist.topSongs ?? artist.songs ?? []
  const albums: Album[] = artist.albums ?? []
  const singles: Album[] = artist.singles ?? []

  function handlePlay(track?: Track, i = 0) {
    if (!songs.length) return
    const targetTrack = track ?? songs[0]
    play(targetTrack, songs.slice(i))
  }

  return (
    <div className="flex-1 space-y-8 pb-12">
      {/* Hero Banner Section */}
      <div className="relative h-80 sm:h-96 w-full rounded-[32px] overflow-hidden group shadow-2xl flex items-end p-6 sm:p-10 border border-white/10">
        {artist.thumbnail && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artist.thumbnail}
            alt={artist.name}
            className="absolute inset-0 w-full h-full object-cover object-center filter brightness-90 group-hover:scale-105 transition-transform duration-700 ease-out"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1f1f1f] via-[#121212] to-[#050505]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />

        <div className="relative z-10 w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 text-white fill-white/20" />
              <span>Verified Artist</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight drop-shadow-md">
              {artist.name}
            </h1>

            {artist.subscribers && (
              <p className="text-sm font-medium text-[#c4c7c8]">
                {artist.subscribers} listeners & subscribers
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => handlePlay()}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
              aria-label="Play artist top tracks"
            >
              <Play className="w-7 h-7 fill-black ml-1" />
            </button>

            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={`px-6 py-3.5 rounded-full font-semibold text-sm backdrop-blur-md border transition-all ${
                isFollowing
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Popular Songs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-tight">Popular Songs</h2>
          </div>

          {songs.length > 0 ? (
            <div className="bg-[#131313]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-1 shadow-xl">
              {songs.slice(0, 8).map((track, i) => (
                <TrackRow
                  key={track.id ?? i}
                  track={track}
                  index={i + 1}
                  onPlay={() => handlePlay(track, i)}
                  showAlbum
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No popular songs available.</p>
          )}
        </div>

        {/* Right Col: Discography Highlights */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white tracking-tight">Artist Bio & Info</h2>
          <div className="bg-[#131313]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl text-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                <UserPlus className="w-6 h-6 text-white/80" />
              </div>
              <div>
                <p className="font-semibold text-white">{artist.name}</p>
                <p className="text-xs text-[#8e9192]">LocalSpo Streaming Artist</p>
              </div>
            </div>
            <p className="text-xs text-[#c4c7c8] leading-relaxed">
              Listen to the complete discography, top hits, albums, and singles on LocalSpo.
            </p>
          </div>
        </div>
      </div>

      {/* Albums Section */}
      {albums.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Albums</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                title={album.title}
                subtitle={String(album.year ?? 'Album')}
                imageUrl={album.thumbnail}
                onClick={() => router.push(`/album/${album.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Singles & EPs Section */}
      {singles.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Singles & EPs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {singles.map((album) => (
              <AlbumCard
                key={album.id}
                title={album.title}
                subtitle={String(album.year ?? 'Single')}
                imageUrl={album.thumbnail}
                onClick={() => router.push(`/album/${album.id}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
