'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Play,
  Pause,
  Shuffle,
  RefreshCw,
  Trash2,
  ArrowLeft,
  Download,
  Share2,
  Plus,
  ArrowUpDown,
  PenSquare,
  Globe,
  Music,
  Camera,
} from 'lucide-react'
import { TrackRow } from '@/components/music/TrackRow'
import { EditPlaylistModal } from '@/components/music/EditPlaylistModal'
import { usePlayerStore } from '@/store/playerStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { useFollowedPlaylistStore } from '@/store/useFollowedPlaylistStore'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
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
  const { playlists: localPlaylists, removePlaylist, updatePlaylist } = usePlaylistStore()
  const { followedPlaylists, unfollowPlaylist } = useFollowedPlaylistStore()
  const { user, profile } = useAuthStore()
  const { showToast } = useToastStore()
  const [imgError, setImgError] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const router = useRouter()

  const localPlaylist = localPlaylists.find((p) => p.id === id)

  // Find matching followed info by localPlaylistId or ID
  const followedEntry = Object.values(followedPlaylists).find(
    (item) => item.localPlaylistId === id || item.spotifyId === id
  )

  const { data: serverPlaylist, isLoading, error, refetch } = useQuery({
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

  const creatorName =
    profile?.displayName ??
    user?.user_metadata?.full_name ??
    user?.email?.split('@')[0] ??
    'LocalSpo'
  const creatorAvatar = profile?.avatarUrl ?? user?.user_metadata?.avatar_url

  async function handleSyncNow(spotifyId: string) {
    setSyncing(true)
    try {
      const res = await syncFollowedPlaylist(spotifyId)
      if (res.newTracksCount > 0) {
        showToast(`Berhasil menyinkronkan ${res.newTracksCount} lagu baru dari Spotify!`, 'success')
      } else {
        showToast('Playlist sudah versi terbaru. Tidak ada lagu baru.', 'info')
      }
    } catch (err) {
      console.error(err)
      showToast('Gagal menyinkronkan playlist Spotify', 'error')
    } finally {
      setSyncing(false)
    }
  }

  function handleShare(title: string) {
    if (navigator.share) {
      navigator.share({
        title,
        text: `Dengarkan playlist "${title}" di LocalSpo`,
        url: window.location.href,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href)
      showToast('Link playlist disalin ke clipboard!', 'success')
    }
  }

  // ==========================================
  // CASE 1: LOCAL PLAYLIST
  // ==========================================
  if (localPlaylist) {
    const songs = localPlaylist.songs || []
    const tracksForRender: Track[] = songs.map(streamSongToTrack)
    const totalDurationSec = Math.round(
      songs.reduce((acc, s) => acc + (s.durationMs || 0), 0) / 1000
    )

    function handlePlayLocal(song: StreamSong, index: number) {
      playSong(song, songs, index, localPlaylist?.name)
    }

    function handlePlayAllLocal() {
      if (songs.length > 0) {
        playSong(songs[0], songs, 0, localPlaylist?.name)
      }
    }

    function handleShuffleLocal() {
      toggleShuffle()
      const state = usePlayerStore.getState()
      const isThisPlaylistPlaying = state.queue.length > 0 && songs.some((s) => s.id === state.currentTrack?.id)
      if (!isThisPlaylistPlaying && songs.length > 0) {
        const randomIndex = Math.floor(Math.random() * songs.length)
        playSong(songs[randomIndex], songs, randomIndex, localPlaylist?.name)
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
        showToast(`Playlist "${localPlaylist.name}" berhasil dihapus`, 'info')
        router.push('/library')
      }
    }

    const isThisPlaylistPlaying =
      isPlaying &&
      queue.length > 0 &&
      (contextTitle === localPlaylist.name || songs.some((s) => s.id === currentTrack?.id))

    return (
      <div className="flex-1 overflow-y-auto pb-28 selection:bg-white/20">
        {/* Back Navigation Bar on Mobile */}
        <div className="sm:hidden px-4 pt-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-white/80 hover:text-white transition-colors active:scale-95"
            aria-label="Kembali"
          >
            <ArrowLeft size={24} />
          </button>

          {followedEntry && (
            <button
              onClick={() => handleSyncNow(followedEntry.spotifyId)}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-xs font-semibold text-gray-200 transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin text-[#38bdf8]' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync Spotify'}</span>
            </button>
          )}
        </div>

        {/* Playlist Header (Desktop Wide Row / Mobile Centered Column) */}
        <div className="relative">
          <div className="px-4 sm:px-6 pt-2 sm:pt-6 pb-4 sm:pb-6 flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-6 text-center sm:text-left">
            {/* Cover Art with Edit Hover */}
            <div
              onClick={() => setIsEditModalOpen(true)}
              className="group relative w-52 h-52 sm:w-56 sm:h-56 shrink-0 rounded-2xl overflow-hidden bg-[#242424] shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/15 cursor-pointer"
              title="Klik untuk mengubah cover playlist"
            >
              {localPlaylist.coverUrl && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localPlaylist.coverUrl}
                  alt={localPlaylist.name}
                  className="w-full h-full object-cover group-hover:scale-105 group-hover:opacity-75 transition-all duration-300"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl text-gray-600">🎵</div>
              )}

              {/* Hover Edit Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 text-white transition-opacity">
                <Camera size={32} />
                <span className="text-xs font-bold">Ganti Foto</span>
              </div>
            </div>

            {/* Playlist Info */}
            <div className="flex flex-col gap-1 min-w-0 flex-1 w-full">
              <p className="text-[11px] sm:text-xs text-gray-400 uppercase tracking-widest font-bold hidden sm:block">
                Playlist
              </p>
              <h1
                onClick={() => setIsEditModalOpen(true)}
                className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight truncate cursor-pointer hover:text-[#38bdf8] transition-colors"
                title="Klik untuk mengubah nama playlist"
              >
                {localPlaylist.name}
              </h1>

              {/* Creator Line */}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 sm:mt-2">
                <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-sky-400 border border-white/20 flex items-center justify-center shrink-0">
                  {creatorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={creatorAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-white">
                      {(creatorName.charAt(0) || 'U').toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-white">{creatorName}</span>
                <span className="text-gray-400 text-xs hidden sm:inline">•</span>
                <span className="text-xs text-gray-400 hidden sm:inline">
                  {songs.length} lagu, {formatDuration(totalDurationSec)}
                </span>
              </div>

              {/* Mobile Duration Subtitle */}
              <div className="flex sm:hidden items-center justify-center gap-1.5 mt-0.5 text-xs text-gray-400">
                <Globe size={13} />
                <span>
                  {songs.length} lagu • {formatDuration(totalDurationSec)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar (Download, Share, 3-dots, Shuffle, Big Play Button) */}
        <div className="px-5 sm:px-6 mt-2 sm:mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Desktop Play Button */}
            <button
              onClick={isThisPlaylistPlaying ? pause : handlePlayAllLocal}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#38bdf8] text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all shrink-0"
              aria-label="Play Playlist"
            >
              {isThisPlaylistPlaying ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" className="ml-0.5" />
              )}
            </button>

            {/* Shuffle Button */}
            <button
              onClick={handleShuffleLocal}
              className={`p-2 transition-colors ${
                shuffle ? 'text-[#38bdf8]' : 'text-gray-400 hover:text-white'
              }`}
              title="Acak Lagu"
            >
              <Shuffle size={22} />
            </button>

            {/* Download Icon */}
            <button
              onClick={() => showToast('Mengunduh playlist untuk mode offline...', 'info')}
              className="p-2 text-gray-300 hover:text-white transition-colors"
              title="Download"
            >
              <Download size={20} />
            </button>

            {/* Share Icon */}
            <button
              onClick={() => handleShare(localPlaylist.name)}
              className="p-2 text-gray-300 hover:text-white transition-colors"
              title="Bagikan"
            >
              <Share2 size={20} />
            </button>

            {/* Desktop Sync Button */}
            {followedEntry && (
              <button
                onClick={() => handleSyncNow(followedEntry.spotifyId)}
                disabled={syncing}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-xs font-semibold text-gray-200 transition-all disabled:opacity-50"
                title="Sinkronkan dengan Spotify"
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin text-[#38bdf8]' : ''} />
                <span>{syncing ? 'Syncing...' : 'Sync Spotify'}</span>
              </button>
            )}

            {/* Delete / Options 3-Dots */}
            <button
              onClick={handleDeleteLocal}
              className="p-2 text-gray-300 hover:text-red-400 transition-colors"
              title="Hapus Playlist"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* Quick Pills Row (Add, Sort, Name & Details) */}
        <div className="px-5 sm:px-6 mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => router.push('/search')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition-all shrink-0 active:scale-95"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>

          <button
            onClick={handleShuffleLocal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition-all shrink-0 active:scale-95"
          >
            <ArrowUpDown size={14} />
            <span>Sort</span>
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition-all shrink-0 active:scale-95"
          >
            <PenSquare size={14} />
            <span>Name & details</span>
          </button>
        </div>

        {/* Tracks List */}
        <div className="px-3 sm:px-6 mt-4 pb-8">
          {songs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Music size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada lagu di playlist ini.</p>
              <button
                onClick={() => router.push('/search')}
                className="mt-3 px-4 py-1.5 rounded-full bg-white text-black font-bold text-xs"
              >
                Cari & Tambah Lagu
              </button>
            </div>
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

        {/* Edit Playlist Modal */}
        <EditPlaylistModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialName={localPlaylist.name}
          initialCoverUrl={localPlaylist.coverUrl}
          onSave={(newName, newCoverUrl) => {
            updatePlaylist(localPlaylist.id, { name: newName, coverUrl: newCoverUrl })
            showToast('Detail playlist berhasil diperbarui!', 'success')
          }}
        />
      </div>
    )
  }

  // ==========================================
  // CASE 2: SERVER PLAYLIST
  // ==========================================
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

  function handleShuffleServer() {
    toggleShuffle()
    const state = usePlayerStore.getState()
    const isThisPlaylistPlaying = state.queue.length > 0 && tracks.some((t) => t.id === state.currentTrack?.id)
    if (!isThisPlaylistPlaying && tracks.length > 0) {
      const randomIndex = Math.floor(Math.random() * tracks.length)
      play(tracks[randomIndex], tracks, randomIndex, serverPlaylist.title)
    }
  }

  const isServerPlaylistPlaying =
    isPlaying &&
    queue.length > 0 &&
    (contextTitle === serverPlaylist.title || tracks.some((t) => t.id === currentTrack?.id))

  const coverUrl = serverPlaylist.coverUrl ?? serverPlaylist.thumbnail

  return (
    <div className="flex-1 overflow-y-auto pb-28 selection:bg-white/20">
      {/* Top Back Navigation Header for mobile */}
      <div className="sm:hidden px-4 pt-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-white/80 hover:text-white transition-colors active:scale-95"
          aria-label="Kembali"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* Playlist Header (Desktop Wide / Mobile Column) */}
      <div className="relative">
        <div className="px-4 sm:px-6 pt-2 sm:pt-6 pb-4 sm:pb-6 flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-6 text-center sm:text-left">
          {/* Cover Art with Edit Hover */}
          <div
            onClick={() => setIsEditModalOpen(true)}
            className="group relative w-52 h-52 sm:w-56 sm:h-56 shrink-0 rounded-2xl overflow-hidden bg-[#242424] shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/15 cursor-pointer"
            title="Klik untuk mengubah cover playlist"
          >
            {coverUrl && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={serverPlaylist.title}
                className="w-full h-full object-cover group-hover:scale-105 group-hover:opacity-75 transition-all duration-300"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl text-gray-600">🎵</div>
            )}

            {/* Hover Edit Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 text-white transition-opacity">
              <Camera size={32} />
              <span className="text-xs font-bold">Ganti Foto</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 min-w-0 flex-1 w-full">
            <p className="text-[11px] sm:text-xs text-gray-400 uppercase tracking-widest font-bold hidden sm:block">
              Playlist
            </p>
            <h1
              onClick={() => setIsEditModalOpen(true)}
              className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight truncate cursor-pointer hover:text-[#38bdf8] transition-colors"
              title="Klik untuk mengubah nama playlist"
            >
              {serverPlaylist.title}
            </h1>

            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 sm:mt-2">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-sky-400 border border-white/20 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white">
                  {(creatorName.charAt(0) || 'U').toUpperCase()}
                </span>
              </div>
              <span className="text-xs font-bold text-white">{creatorName}</span>
              <span className="text-gray-400 text-xs hidden sm:inline">•</span>
              <span className="text-xs text-gray-400 hidden sm:inline">
                {tracks.length} lagu, {formatDuration(totalDuration)}
              </span>
            </div>

            <div className="flex sm:hidden items-center justify-center gap-1.5 mt-0.5 text-xs text-gray-400">
              <Globe size={13} />
              <span>
                {tracks.length} lagu • {formatDuration(totalDuration)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-5 sm:px-6 mt-2 sm:mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={isServerPlaylistPlaying ? pause : handlePlayAll}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#38bdf8] text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            {isServerPlaylistPlaying ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            onClick={handleShuffleServer}
            className={`p-2 transition-colors ${
              shuffle ? 'text-[#38bdf8]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shuffle size={22} />
          </button>

          <button
            onClick={() => handleShare(serverPlaylist.title)}
            className="p-2 text-gray-300 hover:text-white transition-colors"
            title="Bagikan"
          >
            <Share2 size={20} />
          </button>

          <button
            onClick={async () => {
              if (confirm(`Hapus playlist "${serverPlaylist.title}"?`)) {
                await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
                showToast(`Playlist "${serverPlaylist.title}" berhasil dihapus`, 'info')
                router.push('/library')
              }
            }}
            className="p-2 text-gray-300 hover:text-red-400 transition-colors"
            title="Hapus"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Quick Pills Row (Add, Sort, Name & Details) */}
      <div className="px-5 sm:px-6 mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => router.push('/search')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition-all shrink-0 active:scale-95"
        >
          <Plus size={14} />
          <span>Add</span>
        </button>

        <button
          onClick={handleShuffleServer}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition-all shrink-0 active:scale-95"
        >
          <ArrowUpDown size={14} />
          <span>Sort</span>
        </button>

        <button
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition-all shrink-0 active:scale-95"
        >
          <PenSquare size={14} />
          <span>Name & details</span>
        </button>
      </div>

      {/* Tracks */}
      <div className="px-3 sm:px-6 mt-5 pb-8">
        {tracks.length === 0 ? (
          <p className="text-gray-400 px-2 py-4">Belum ada lagu di playlist ini.</p>
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

      {/* Edit Playlist Modal */}
      <EditPlaylistModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialName={serverPlaylist.title}
        initialCoverUrl={serverPlaylist.coverUrl ?? serverPlaylist.thumbnail}
        onSave={async (newName, newCoverUrl) => {
          try {
            await fetch(`/api/playlists/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: newName, coverUrl: newCoverUrl }),
            })
            refetch()
            showToast('Detail playlist berhasil diperbarui!', 'success')
          } catch (err) {
            console.error(err)
            showToast('Gagal memperbarui playlist', 'error')
          }
        }}
      />
    </div>
  )
}
