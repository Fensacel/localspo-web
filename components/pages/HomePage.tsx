'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { TrackRow } from '@/components/music/TrackRow'
import { Track } from '@/types/track'
import { usePlayerStore } from '@/store/playerStore'
import { useRouter } from 'next/navigation'
import { Music } from 'lucide-react'

export function HomePage() {
  const { user } = useAuthStore()
  const { play } = usePlayerStore()
  const { playlists: localPlaylists } = usePlaylistStore()
  const router = useRouter()

  const { data: serverPlaylists } = useQuery({
    queryKey: ['playlists'],
    queryFn: async () => {
      const res = await fetch('/api/playlists')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })

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
    play(track, tracks, idx >= 0 ? idx : 0)
  }

  // Combine local and server playlists for top grid
  const userPlaylists = [
    ...localPlaylists.map((pl) => ({
      id: pl.id,
      title: pl.name,
      coverUrl: pl.coverUrl,
      subtitle: `${pl.songs.length} songs`,
      isPlaylist: true,
      track: null,
    })),
    ...(serverPlaylists ?? [])
      .filter(
        (spl: any) =>
          !localPlaylists.some(
            (lpl) =>
              lpl.id === spl.id ||
              lpl.name.toLowerCase().trim() === spl.title?.toLowerCase().trim()
          )
      )
      .map((spl: any) => {
        const count = Array.isArray(spl.playlist_tracks)
          ? spl.playlist_tracks[0]?.count ?? spl.playlist_tracks.length
          : spl.tracks?.length ?? 0
        return {
          id: spl.id,
          title: spl.title,
          coverUrl: spl.cover_url || spl.coverUrl,
          subtitle: `${count} songs`,
          isPlaylist: true,
          track: null,
        }
      }),
  ].slice(0, 9)

  const quickPickTracks = (trending ? trending.slice(0, 9) : []).map((t) => ({
    id: t.id,
    title: t.title,
    coverUrl: t.thumbnail ?? t.thumbnailUrl,
    subtitle: t.artist?.name ?? '',
    isPlaylist: false,
    track: t,
  }))

  const topGridItems = userPlaylists.length > 0 ? userPlaylists : quickPickTracks

  return (
    <div className="flex-1 space-y-8 pb-12" suppressHydrationWarning>
      {/* Top Playlists / Music Grid */}
      {topGridItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {topGridItems.map((item) => {
            const isPlayingThis =
              isPlaying &&
              (contextTitle === item.title ||
                (item.isPlaylist &&
                  localPlaylists
                    .find((p) => p.id === item.id)
                    ?.songs.some((s) => s.id === currentTrack?.id)) ||
                (!item.isPlaylist && currentTrack?.id === item.id))

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.isPlaylist) {
                    router.push(`/playlist/${item.id}`)
                  } else if (item.track) {
                    handlePlay(
                      item.track,
                      quickPickTracks.map((q) => q.track!)
                    )
                  }
                }}
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-all duration-300 shadow-md ${
                  isPlayingThis
                    ? 'bg-blue-950/30 border border-blue-500/40 shadow-blue-500/10'
                    : 'bg-[#141414]/70 hover:bg-[#1f1f1f] border border-white/10'
                }`}
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center text-gray-400">
                      <Music size={18} />
                    </div>
                  )}
                  {isPlayingThis && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Volume2 size={16} className="text-blue-400 animate-pulse" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-bold truncate transition-colors ${
                      isPlayingThis ? 'text-blue-400' : 'text-white group-hover:text-blue-400'
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5 flex items-center gap-1.5">
                    {isPlayingThis && (
                      <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                        Playing •
                      </span>
                    )}
                    <span>{item.subtitle}</span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

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

      {/* Made For You */}
      {trending && trending.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Made For You</h2>
          </div>
          <div className="bg-[#131313]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-1 shadow-xl">
            {trending.slice(0, 8).map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                onPlay={() => handlePlay(track, trending)}
                showAlbum
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
