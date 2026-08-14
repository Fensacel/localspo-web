'use client'

import { useMemo, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { usePlayerStore } from '@/store/playerStore'
import { Track } from '@/types/track'
import { useRouter } from 'next/navigation'
import { TrackContextMenu } from '@/components/music/TrackContextMenu'
import {
  Music,
  Volume2,
  Sparkles,
  ChevronRight,
  Radio,
  Flame,
  MoreVertical,
  Download,
} from 'lucide-react'
import { ImportPlaylistModal } from '@/components/playlist/ImportPlaylistModal'

export function HomePage() {
  const { user } = useAuthStore()
  const { play, pause, isPlaying, currentTrack, contextTitle } = usePlayerStore()
  const { playlists: localPlaylists } = usePlaylistStore()
  const [contextMenu, setContextMenu] = useState<{ track: Track; position: { x: number; y: number } } | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const router = useRouter()
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Fetch user cloud playlists
  const { data: serverPlaylists } = useQuery({
    queryKey: ['playlists', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/playlists')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })

  // 2. Dynamically extract Top Artists from user's playlists (Only if user actually has playlists)
  const topPlaylistArtists = useMemo(() => {
    const counts = new Map<string, number>()
    const addArtist = (name?: string | null) => {
      if (!name || name === 'Unknown' || name === 'Unknown Artist') return
      const clean = name.trim()
      if (clean.length < 2) return
      counts.set(clean, (counts.get(clean) || 0) + 1)
    }

    for (const pl of localPlaylists) {
      for (const song of pl.songs || []) {
        const art = typeof song.artist === 'string' ? song.artist : song.artist?.name
        addArtist(art)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const spl of serverPlaylists ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const song of spl.tracks || spl.playlist_tracks || []) {
        const art = typeof song.artist === 'string' ? song.artist : song.artist?.name
        addArtist(art)
      }
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([art]) => art)

    return sorted
  }, [localPlaylists, serverPlaylists])

  const topArtist1 = topPlaylistArtists.length > 0 ? topPlaylistArtists[0] : null
  const topArtist2 = topPlaylistArtists.length > 1 ? topPlaylistArtists[1] : null

  // 3. Fetch Personalized Recommendations based on Artist 1 (Only if user has playlists)
  const { data: recsArtist1 } = useQuery<Track[]>({
    queryKey: ['recs-artist-1', topArtist1],
    queryFn: async () => {
      if (!topArtist1) return []
      const res = await fetch(`/api/search?q=${encodeURIComponent(topArtist1 + ' songs hits')}&type=songs`)
      const json = await res.json()
      return json.data?.songs ?? []
    },
    enabled: !!topArtist1,
    staleTime: 10 * 60 * 1000,
  })

  // 4. Fetch Personalized Recommendations based on Artist 2 (Only if user has playlists)
  const { data: recsArtist2 } = useQuery<Track[]>({
    queryKey: ['recs-artist-2', topArtist2],
    queryFn: async () => {
      if (!topArtist2) return []
      const res = await fetch(`/api/search?q=${encodeURIComponent(topArtist2 + ' songs hits')}&type=songs`)
      const json = await res.json()
      return json.data?.songs ?? []
    },
    enabled: !!topArtist2,
    staleTime: 10 * 60 * 1000,
  })

  // 5. Fetch Global / Indonesian Trending Hits (Default for all users)
  const { data: trendingHits } = useQuery<Track[]>({
    queryKey: ['trending-home'],
    queryFn: async () => {
      const res = await fetch('/api/search?q=top+50+indonesia+global+hits&type=songs')
      const json = await res.json()
      return json.data?.songs ?? []
    },
    staleTime: 15 * 60 * 1000,
  })

  // 6. Fetch Popular New Releases for New Accounts
  const { data: popularHits } = useQuery<Track[]>({
    queryKey: ['popular-hits-home'],
    queryFn: async () => {
      const res = await fetch('/api/search?q=popular+music+hits+today&type=songs')
      const json = await res.json()
      return json.data?.songs ?? []
    },
    staleTime: 15 * 60 * 1000,
  })

  // 7. Fetch Play History
  const { data: history } = useQuery<Track[]>({
    queryKey: ['history', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/history')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  function handlePlayTrack(track: Track, trackList: Track[], titleContext?: string) {
    const isCurrentlyPlayingThis = isPlaying && currentTrack?.id === track.id
    if (isCurrentlyPlayingThis) {
      pause()
    } else {
      const idx = trackList.findIndex((t) => t.id === track.id)
      play(track, trackList, idx >= 0 ? idx : 0, titleContext)
    }
  }

  function handleCardContextMenu(e: React.MouseEvent, track: Track) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ track, position: { x: e.clientX, y: e.clientY } })
  }

  function handleCardDotsClick(e: React.MouseEvent, track: Track) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setContextMenu({ track, position: { x: rect.left, y: rect.bottom + 4 } })
  }

  function handleTouchStart(e: React.TouchEvent, track: Track) {
    const touch = e.touches[0]
    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({ track, position: { x: touch.clientX, y: touch.clientY } })
    }, 500)
  }

  function handleTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  // Combine local and server playlists with strict deduplication
  const seenIds = new Set<string>()
  const seenTitles = new Set<string>()
  const uniquePlaylists: Array<{
    id: string
    title: string
    coverUrl?: string
    subtitle: string
    isPlaylist: boolean
    track: Track | null
    songs: Track[]
  }> = []

  for (const pl of localPlaylists) {
    const normTitle = pl.name.toLowerCase().trim()
    if (!seenIds.has(pl.id) && !seenTitles.has(normTitle)) {
      seenIds.add(pl.id)
      seenTitles.add(normTitle)
      uniquePlaylists.push({
        id: pl.id,
        title: pl.name,
        coverUrl: pl.coverUrl,
        subtitle: `${pl.songs.length} tracks`,
        isPlaylist: true,
        track: null,
        songs: pl.songs,
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const spl of serverPlaylists ?? []) {
    const normTitle = (spl.title || '').toLowerCase().trim()
    if (!seenIds.has(spl.id) && !seenTitles.has(normTitle)) {
      seenIds.add(spl.id)
      seenTitles.add(normTitle)
      uniquePlaylists.push({
        id: spl.id,
        title: spl.title,
        coverUrl: spl.cover_url || spl.coverUrl,
        subtitle: `${spl.playlist_tracks?.length ?? 0} tracks`,
        isPlaylist: true,
        track: null,
        songs: spl.tracks ?? [],
      })
    }
  }

  // If fewer than 8 playlists: fill with trending hits (for fresh accounts) or artist recs
  const fallbackSongs = topArtist1 && recsArtist1 && recsArtist1.length > 0 ? recsArtist1 : (trendingHits || [])
  const distinctPicks = fallbackSongs
    .filter((t) => !seenIds.has(t.id) && !seenTitles.has(t.title.toLowerCase().trim()))
    .map((t) => ({
      id: t.id,
      title: t.title,
      coverUrl: t.thumbnail ?? t.thumbnailUrl,
      subtitle: typeof t.artist === 'string' ? t.artist : t.artist?.name ?? '',
      isPlaylist: false,
      track: t,
      songs: [],
    }))

  const topGridItems = [...uniquePlaylists, ...distinctPicks].slice(0, 8)

  return (
    <div className="flex-1 space-y-7 pb-8 pt-1 selection:bg-white/20" suppressHydrationWarning>
      {/* 1. Top Quick Playlist / Song Grid (2 Columns on mobile, 4 Columns on desktop) */}
      {topGridItems.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {topGridItems.map((item) => {
            const isPlayingThis =
              isPlaying &&
              (contextTitle === item.title ||
                (item.isPlaylist && item.songs.some((s) => s.id === currentTrack?.id)) ||
                (!item.isPlaylist && currentTrack?.id === item.id))

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.isPlaylist) {
                    router.push(`/playlist/${item.id}`)
                  } else if (item.track) {
                    handlePlayTrack(item.track, fallbackSongs, 'Top Picks')
                  }
                }}
                onContextMenu={(e) => item.track && handleCardContextMenu(e, item.track)}
                onTouchStart={(e) => item.track && handleTouchStart(e, item.track)}
                onTouchEnd={handleTouchEnd}
                className={`h-14 rounded-lg flex items-center justify-between overflow-hidden cursor-pointer group transition-all duration-200 shadow-md relative ${
                  isPlayingThis
                    ? 'bg-[#383838] border border-[#38bdf8]/60'
                    : 'bg-[#282828]/85 hover:bg-[#383838] border border-white/5'
                }`}
              >
                <div className="flex items-center min-w-0 flex-1 h-full">
                  <div className="w-14 h-14 rounded-l-lg overflow-hidden bg-[#181818] shrink-0 relative">
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
                        <Volume2 size={16} className="text-[#38bdf8] animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 px-2.5">
                    <p
                      className={`text-xs font-bold truncate leading-snug ${
                        isPlayingThis ? 'text-[#38bdf8]' : 'text-white'
                      }`}
                    >
                      {item.title}
                    </p>
                  </div>
                </div>

                {item.track && (
                  <button
                    onClick={(e) => item.track && handleCardDotsClick(e, item.track)}
                    className="p-2 text-gray-400 hover:text-white transition-opacity opacity-0 group-hover:opacity-100 sm:block hidden shrink-0"
                    title="Opsi lagu"
                  >
                    <MoreVertical size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New Account Callout: Import Playlist Banner if no playlist imported yet */}
      {topPlaylistArtists.length === 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-sky-900/20 to-black border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
              <Sparkles size={16} className="text-[#38bdf8]" />
              Personalisasi Beranda Kamu
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Import playlist Spotify kamu untuk mendapatkan rekomendasi musik yang disesuaikan dengan seleramu.
            </p>
          </div>
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#38bdf8] hover:bg-[#38bdf8]/90 text-black font-bold text-xs rounded-full shadow-lg active:scale-95 transition-all shrink-0"
          >
            <Download size={14} />
            <span>Import Playlist Spotify</span>
          </button>
        </div>
      )}

      {/* 2. Personalized Artist Recommendation 1 (Only if user has imported playlists with artists) */}
      {topArtist1 && recsArtist1 && recsArtist1.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Berdasarkan Playlist Kamu
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Sparkles size={18} className="text-[#38bdf8]" />
                More like {topArtist1}
              </h2>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>

          <div className="flex gap-3.5 overflow-x-auto pb-2 scroll-smooth custom-scrollbar no-scrollbar">
            {recsArtist1.map((track) => {
              const isPlayingThis = isPlaying && currentTrack?.id === track.id
              const trackThumb = track.thumbnail ?? track.thumbnailUrl

              return (
                <div
                  key={track.id}
                  onClick={() => handlePlayTrack(track, recsArtist1, `More like ${topArtist1}`)}
                  onContextMenu={(e) => handleCardContextMenu(e, track)}
                  onTouchStart={(e) => handleTouchStart(e, track)}
                  onTouchEnd={handleTouchEnd}
                  className="w-36 sm:w-40 shrink-0 cursor-pointer group relative"
                >
                  <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-[#1e1e1e] relative shadow-lg">
                    {trackThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={trackThumb}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">♪</div>
                    )}

                    <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center">
                      <Sparkles size={11} className="text-[#38bdf8]" />
                    </div>

                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Volume2 size={24} className="text-[#38bdf8] animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs font-bold text-white truncate flex-1 group-hover:text-[#38bdf8] transition-colors">
                      {track.title}
                    </p>
                    <button
                      onClick={(e) => handleCardDotsClick(e, track)}
                      className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0"
                      title="Opsi lagu"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {typeof track.artist === 'string' ? track.artist : track.artist?.name || topArtist1}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 3. Personalized Artist Recommendation 2 (Only if user has 2nd artist) */}
      {topArtist2 && recsArtist2 && recsArtist2.length > 0 && topArtist2 !== topArtist1 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Rekomendasi Artis Favorit
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Radio size={18} className="text-[#38bdf8]" />
                More like {topArtist2}
              </h2>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>

          <div className="flex gap-3.5 overflow-x-auto pb-2 scroll-smooth custom-scrollbar no-scrollbar">
            {recsArtist2.map((track) => {
              const isPlayingThis = isPlaying && currentTrack?.id === track.id
              const trackThumb = track.thumbnail ?? track.thumbnailUrl

              return (
                <div
                  key={track.id}
                  onClick={() => handlePlayTrack(track, recsArtist2, `More like ${topArtist2}`)}
                  onContextMenu={(e) => handleCardContextMenu(e, track)}
                  onTouchStart={(e) => handleTouchStart(e, track)}
                  onTouchEnd={handleTouchEnd}
                  className="w-36 sm:w-40 shrink-0 cursor-pointer group relative"
                >
                  <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-[#1e1e1e] relative shadow-lg">
                    {trackThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={trackThumb}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">♪</div>
                    )}

                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Volume2 size={24} className="text-[#38bdf8] animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs font-bold text-white truncate flex-1 group-hover:text-[#38bdf8] transition-colors">
                      {track.title}
                    </p>
                    <button
                      onClick={(e) => handleCardDotsClick(e, track)}
                      className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0"
                      title="Opsi lagu"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {typeof track.artist === 'string' ? track.artist : track.artist?.name || topArtist2}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 4. Horizontal Scroll: "Top 50 Indonesia & Global Hits" */}
      {trendingHits && trendingHits.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Tangga Lagu Terpopuler
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Flame size={18} className="text-[#38bdf8]" />
                Top 50 Indonesia & Global
              </h2>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>

          <div className="flex gap-3.5 overflow-x-auto pb-2 scroll-smooth custom-scrollbar no-scrollbar">
            {trendingHits.map((track) => {
              const isPlayingThis = isPlaying && currentTrack?.id === track.id
              const trackThumb = track.thumbnail ?? track.thumbnailUrl

              return (
                <div
                  key={track.id}
                  onClick={() => handlePlayTrack(track, trendingHits, 'Top 50 Indonesia & Global')}
                  onContextMenu={(e) => handleCardContextMenu(e, track)}
                  onTouchStart={(e) => handleTouchStart(e, track)}
                  onTouchEnd={handleTouchEnd}
                  className="w-36 sm:w-40 shrink-0 cursor-pointer group relative"
                >
                  <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-[#1e1e1e] relative shadow-lg">
                    {trackThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={trackThumb}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">♪</div>
                    )}

                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Volume2 size={24} className="text-[#38bdf8] animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs font-bold text-white truncate flex-1 group-hover:text-[#38bdf8] transition-colors">
                      {track.title}
                    </p>
                    <button
                      onClick={(e) => handleCardDotsClick(e, track)}
                      className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0"
                      title="Opsi lagu"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {typeof track.artist === 'string' ? track.artist : track.artist?.name || 'LocalSpo'}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 5. Horizontal Scroll: "Lagu Populer & Hits Pilihan" (Especially useful for new accounts) */}
      {popularHits && popularHits.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Pilihan Untukmu
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <Radio size={18} className="text-[#38bdf8]" />
                Lagu Populer Hari Ini
              </h2>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>

          <div className="flex gap-3.5 overflow-x-auto pb-2 scroll-smooth custom-scrollbar no-scrollbar">
            {popularHits.map((track) => {
              const isPlayingThis = isPlaying && currentTrack?.id === track.id
              const trackThumb = track.thumbnail ?? track.thumbnailUrl

              return (
                <div
                  key={track.id}
                  onClick={() => handlePlayTrack(track, popularHits, 'Lagu Populer Hari Ini')}
                  onContextMenu={(e) => handleCardContextMenu(e, track)}
                  onTouchStart={(e) => handleTouchStart(e, track)}
                  onTouchEnd={handleTouchEnd}
                  className="w-36 sm:w-40 shrink-0 cursor-pointer group relative"
                >
                  <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-[#1e1e1e] relative shadow-lg">
                    {trackThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={trackThumb}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">♪</div>
                    )}

                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Volume2 size={24} className="text-[#38bdf8] animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs font-bold text-white truncate flex-1 group-hover:text-[#38bdf8] transition-colors">
                      {track.title}
                    </p>
                    <button
                      onClick={(e) => handleCardDotsClick(e, track)}
                      className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0"
                      title="Opsi lagu"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {typeof track.artist === 'string' ? track.artist : track.artist?.name || 'Popular'}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 6. Horizontal Scroll: "Recently Played" (if history available) */}
      {history && history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-[#38bdf8]" />
              Baru Saja Diputar
            </h2>
            <ChevronRight size={18} className="text-gray-400" />
          </div>

          <div className="flex gap-3.5 overflow-x-auto pb-2 scroll-smooth custom-scrollbar no-scrollbar">
            {history.map((track) => {
              const isPlayingThis = isPlaying && currentTrack?.id === track.id
              const trackThumb = track.thumbnail ?? track.thumbnailUrl

              return (
                <div
                  key={track.id}
                  onClick={() => handlePlayTrack(track, history, 'Recently Played')}
                  onContextMenu={(e) => handleCardContextMenu(e, track)}
                  onTouchStart={(e) => handleTouchStart(e, track)}
                  onTouchEnd={handleTouchEnd}
                  className="w-36 sm:w-40 shrink-0 cursor-pointer group relative"
                >
                  <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-[#1e1e1e] relative shadow-lg">
                    {trackThumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={trackThumb}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">♪</div>
                    )}

                    {isPlayingThis && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Volume2 size={24} className="text-[#38bdf8] animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs font-bold text-white truncate flex-1 group-hover:text-[#38bdf8] transition-colors">
                      {track.title}
                    </p>
                    <button
                      onClick={(e) => handleCardDotsClick(e, track)}
                      className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0"
                      title="Opsi lagu"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {typeof track.artist === 'string' ? track.artist : track.artist?.name || 'LocalSpo'}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Context Menu Portal */}
      {contextMenu && (
        <TrackContextMenu
          track={contextMenu.track}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}

      <ImportPlaylistModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  )
}
