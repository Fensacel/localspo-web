'use client'

import { useQuery } from '@tanstack/react-query'
import { Play, Pause, RefreshCw, Shuffle, Trash2 } from 'lucide-react'
import { TrackRow } from '@/components/music/TrackRow'
import { usePlayerStore } from '@/store/playerStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { useFollowedPlaylistStore } from '@/store/useFollowedPlaylistStore'
import { syncFollowedPlaylist } from '@/lib/syncManager'
import { playSong } from '@/lib/playSong'
import { formatDuration } from '@/lib/utils/formatDuration'
import { useState } from 'react'
import { Track } from '@/types/track'
import { useRouter } from 'next/navigation'
import type { StreamSong } from '@/types/streamSong'

interface PlaylistPageProps {
  id: string
}

function streamSongToTrack(song: StreamSong): Track {
  return {
    id: song.id,
    videoId: song.resolvedVideoId,
    title: song.title,
    artist: { name: song.artist },
    album: song.album ? { name: song.album } : undefined,
    duration: Math.round(song.durationMs / 1000),
    thumbnail: song.coverUrl,
    thumbnailUrl: song.coverUrl,
    source: 'spotify',
  }
}

export function PlaylistPage({ id }: PlaylistPageProps) {
  const { play, shuffle, toggleShuffle, pause, isPlaying, currentTrack, queue, contextTitle } =
    usePlayerStore()
  const { playlists: localPlaylists, removePlaylist } = usePlaylistStore()
  const { followedPlaylists, unfollowPlaylist } = useFollowedPlaylistStore()
  const [imgError, setImgError] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()

  const localPlaylist = localPlaylists.find((p) => p.id === id)

  // Find matching followed info by localPlaylistId or ID
  const followedEntry = Object.values(followedPlaylists).find(
    (item) => item.localPlaylistId === id || item.spotifyId === id
  )

  const { data: serverPlaylist, isLoading, error } = useQuery({
    queryKey: ['playlist', id],
    queryFn: async () => {
      const res = await fetch(`/api/playlists/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load playlist')
      return json.data
    },
    enabled: !localPlaylist,
    staleTime: 5 * 60 * 1000,
  })

  async function handleSyncNow(spotifyId: string) {
    setSyncing(true)
    try {
      const res = await syncFollowedPlaylist(spotifyId)
      if (res.newTracksCount > 0) {
        alert(`Berhasil menyinkronkan! Mengambil ${res.newTracksCount} lagu baru dari Spotify.`)
      } else {
        alert('Playlist sudah versi terbaru. Tidak ada lagu baru.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSyncing(false)
    }
  }

  // If locally available from usePlaylistStore
  if (localPlaylist) {
    const songs = localPlaylist.songs || []
    const tracksForRender: Track[] = songs.map(streamSongToTrack)
    const totalDurationSec = Math.round(
      songs.reduce((acc, s) => acc + (s.durationMs || 0), 0) / 1000
    )

    function handlePlayLocal(song: StreamSong, index: number) {
      playSong(song, songs, index, localPlaylist.name)
    }

    function handlePlayAllLocal() {
      if (songs.length > 0) {
        playSong(songs[0], songs, 0, localPlaylist.name)
      }
    }

    function handleShuffleLocal() {
      toggleShuffle()
      const state = usePlayerStore.getState()
      const isThisPlaylistPlaying = state.queue.length > 0 && songs.some((s) => s.id === state.currentTrack?.id)
      if (!isThisPlaylistPlaying && songs.length > 0) {
        const randomIndex = Math.floor(Math.random() * songs.length)
        playSong(songs[randomIndex], songs, randomIndex, localPlaylist.name)
      }
    }

    async function handleDeleteLocal() {
      if (!localPlaylist) return
      if (confirm(`Apakah kamu yakin ingin menghapus playlist "${localPlaylist.name}"?`)) {
        if (followedEntry) {
          unfollowPlaylist(followedEntry.spotifyId)
        }
        try {
          await fetch(`/api/playlists/${localPlaylist.id}`, { method: 'DELETE' })
        } catch (dbErr) {
          console.warn('[handleDeleteLocal] Failed to delete playlist from database:', dbErr)
        }
        removePlaylist(localPlaylist.id)
        router.push('/library')
      }
    }

    const isThisPlaylistPlaying =
      isPlaying &&
      queue.length > 0 &&
      (contextTitle === localPlaylist.name || songs.some((s) => s.id === currentTrack?.id))

    return (
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-[#0a0a0a]" />
          <div className="relative px-6 pt-8 pb-6 flex items-end gap-6">
            <div className="w-44 h-44 shrink-0 rounded-lg overflow-hidden bg-[#2a2a2a] shadow-2xl">
              {localPlaylist.coverUrl && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localPlaylist.coverUrl}
                  alt={localPlaylist.name}
                  className="object-cover w-full h-full"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl text-gray-700">🎵</div>
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Playlist</p>
              <h1 className="text-3xl font-bold truncate">{localPlaylist.name}</h1>
              <p className="text-sm text-gray-400">
                {songs.length} tracks · {formatDuration(totalDurationSec)}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={isThisPlaylistPlaying ? pause : handlePlayAllLocal}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-all shadow-lg shadow-blue-600/20"
            >
              {isThisPlaylistPlaying ? (
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
              onClick={handleShuffleLocal}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                shuffle
                  ? 'bg-white/10 hover:bg-white/20 border border-white/20 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white'
              }`}
            >
              <Shuffle size={14} className={shuffle ? 'text-white' : 'text-gray-400'} />
              <span>Shuffle</span>
            </button>

            {followedEntry && (
              <button
                onClick={() => handleSyncNow(followedEntry.spotifyId)}
                disabled={syncing}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-semibold text-gray-300 hover:text-white transition-all disabled:opacity-50"
                title="Cek lagu baru dari Spotify sekarang"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin text-blue-400' : ''} />
                <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            )}
          </div>
          <button
            onClick={handleDeleteLocal}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold transition-all shadow-sm"
            title="Hapus Playlist"
          >
            <Trash2 size={16} />
            <span>Hapus Playlist</span>
          </button>
        </div>

        {/* Tracks */}
        <div className="px-4 pb-8">
          {songs.length === 0 ? (
            <p className="text-gray-400 px-2 py-4">No tracks in this playlist.</p>
          ) : (
            <div className="space-y-1">
              {songs.map((song, i) => (
                <TrackRow
                  key={song.id ?? i}
                  track={tracksForRender[i]}
                  index={i + 1}
                  onPlay={() => handlePlayLocal(song, i)}
                  showAlbum
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback to server playlist query
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <span className="animate-pulse">Loading playlist…</span>
      </div>
    )
  }

  if (error || !serverPlaylist) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400">
        Failed to load playlist.
      </div>
    )
  }

  const tracks: Track[] = serverPlaylist.tracks ?? []
  const totalDuration = tracks.reduce((acc: number, t: Track) => acc + (t.duration ?? 0), 0)

  function handlePlay(track: Track, i: number) {
    play(track, tracks, i, serverPlaylist.title)
  }

  function handlePlayAll() {
    if (tracks.length > 0) {
      play(tracks[0], tracks, 0, serverPlaylist.title)
    }
  }

  function handleShuffle() {
    toggleShuffle()
    const state = usePlayerStore.getState()
    const isThisPlaylistPlaying = state.queue.length > 0 && tracks.some((t) => t.id === state.currentTrack?.id)
    if (!isThisPlaylistPlaying && tracks.length > 0) {
      const randomIndex = Math.floor(Math.random() * tracks.length)
      play(tracks[randomIndex], tracks, randomIndex, serverPlaylist.title)
    }
  }

  async function handleDeleteServer() {
    if (confirm(`Apakah kamu yakin ingin menghapus playlist "${serverPlaylist.title}"?`)) {
      try {
        await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
        router.push('/library')
      } catch (err) {
        console.error('Failed to delete server playlist:', err)
      }
    }
  }

  const coverUrl = serverPlaylist.coverUrl ?? serverPlaylist.thumbnail

  return (
    <div className="flex-1 overflow-y-auto pb-28">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 to-[#0a0a0a]" />
        <div className="relative px-6 pt-8 pb-6 flex items-end gap-6">
          <div className="w-44 h-44 shrink-0 rounded-lg overflow-hidden bg-[#2a2a2a] shadow-2xl">
            {coverUrl && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={serverPlaylist.title}
                className="object-cover w-full h-full"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-gray-700">🎵</div>
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Playlist</p>
            <h1 className="text-3xl font-bold truncate">{serverPlaylist.title}</h1>
            {serverPlaylist.description && (
              <p className="text-gray-400 text-sm">{serverPlaylist.description}</p>
            )}
            <p className="text-sm text-gray-500">
              {tracks.length} tracks · {formatDuration(totalDuration)}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      {(() => {
        const isThisPlaylistPlaying =
          isPlaying &&
          queue.length > 0 &&
          (contextTitle === serverPlaylist.title || tracks.some((t) => t.id === currentTrack?.id))

        return (
          <div className="px-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={isThisPlaylistPlaying ? pause : handlePlayAll}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-medium transition-colors"
              >
                {isThisPlaylistPlaying ? (
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
            <button
              onClick={handleDeleteServer}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold transition-all shadow-sm"
              title="Hapus Playlist"
            >
              <Trash2 size={16} />
              <span>Hapus Playlist</span>
            </button>
          </div>
        )
      })()}

      {/* Tracks */}
      <div className="px-4 pb-8">
        {tracks.length === 0 ? (
          <p className="text-gray-400 px-2 py-4">No tracks in this playlist.</p>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id ?? i}
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
