'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, ListPlus, PlusCircle, Heart, Music, ListOrdered, ChevronRight, Check } from 'lucide-react'
import { Track } from '@/types/track'
import { usePlayerStore } from '@/store/playerStore'
import { useLikedTracks } from '@/lib/hooks/useLikedTracks'
import { usePlaylists } from '@/lib/hooks/usePlaylists'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { useToastStore } from '@/store/toastStore'
import type { StreamSong } from '@/types/streamSong'

interface ContextMenuPosition {
  x: number
  y: number
}

interface TrackContextMenuProps {
  track: Track
  position: ContextMenuPosition | null
  onClose: () => void
}

function trackToStreamSong(track: Track): StreamSong {
  const artistStr =
    typeof track.artist === 'string'
      ? track.artist
      : track.artist?.name || 'Unknown Artist'
  const albumStr =
    typeof track.album === 'string'
      ? track.album
      : track.album?.name || 'Single'

  return {
    id: track.id,
    title: track.title,
    artist: artistStr,
    album: albumStr,
    durationMs: (track.duration || 0) * 1000,
    coverUrl: track.thumbnail || track.thumbnailUrl || '',
    source: 'spotify',
    resolvedVideoId: track.videoId,
  }
}

export function TrackContextMenu({ track, position, onClose }: TrackContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { play, addToQueue, playNext } = usePlayerStore()
  const { isLiked, toggleLike } = useLikedTracks()
  const { playlists: serverPlaylists, addTrackToPlaylist, createPlaylist } = usePlaylists()
  const { playlists: localPlaylists, addSongToPlaylist, removeSongFromPlaylist } = usePlaylistStore()
  const { showToast } = useToastStore()

  const [showPlaylistsSubmenu, setShowPlaylistsSubmenu] = useState(false)
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<string[]>([])
  const [isMobile, setIsMobile] = useState(false)

  const liked = isLiked(track.id)
  const trackArtist =
    typeof track.artist === 'string'
      ? track.artist
      : track.artist?.name || ''

  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close menu on click outside or escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!position) return null

  // Combine local and server playlists with deduplication
  const combinedPlaylists = [
    ...localPlaylists.map((p) => ({ id: p.id, title: p.name, isLocal: true, songs: p.songs })),
    ...(serverPlaylists || [])
      .filter((sp) => !localPlaylists.some((lp) => lp.id === sp.id || lp.name.toLowerCase().trim() === sp.title.toLowerCase().trim()))
      .map((sp) => ({ id: sp.id, title: sp.title, isLocal: false, songs: [] as StreamSong[] })),
  ]

  // Check if track is already present in a given playlist
  const isTrackInPlaylist = (playlistId: string) => {
    const localPl = localPlaylists.find((p) => p.id === playlistId)
    if (localPl && Array.isArray(localPl.songs)) {
      const match = localPl.songs.some(
        (s) =>
          s.id === track.id ||
          (s.title?.toLowerCase().trim() === track.title?.toLowerCase().trim() &&
            s.artist?.toLowerCase().trim() === trackArtist.toLowerCase().trim())
      )
      if (match) return true
    }
    return addedPlaylistIds.includes(playlistId)
  }

  // Desktop positioning
  const menuWidth = 240
  const menuHeight = 280
  const left = isMobile ? 0 : Math.min(position.x, window.innerWidth - menuWidth - 10)
  const top = isMobile ? 0 : Math.min(position.y, window.innerHeight - menuHeight - 10)

  const handlePlayNow = () => {
    play(track)
    onClose()
  }

  const handlePlayNext = () => {
    playNext(track)
    showToast('Ditambahkan ke putar berikutnya', 'info')
    onClose()
  }

  const handleAddToQueue = () => {
    addToQueue(track)
    showToast('Ditambahkan ke antrean', 'info')
    onClose()
  }

  const handleToggleLike = () => {
    toggleLike(track)
    showToast(liked ? 'Dihapus dari Lagu yang Disukai' : 'Ditambahkan ke Lagu yang Disukai', 'success')
    onClose()
  }

  const handleTogglePlaylistTrack = async (playlistId: string, playlistTitle: string) => {
    const isAlreadyIn = isTrackInPlaylist(playlistId)
    const localPl = localPlaylists.find((p) => p.id === playlistId)

    if (isAlreadyIn) {
      // Remove from playlist
      if (localPl) {
        const matchingSong = localPl.songs.find(
          (s) =>
            s.id === track.id ||
            (s.title?.toLowerCase().trim() === track.title?.toLowerCase().trim() &&
              s.artist?.toLowerCase().trim() === trackArtist.toLowerCase().trim())
        )
        if (matchingSong) {
          removeSongFromPlaylist(playlistId, matchingSong.id)
        }
      }
      setAddedPlaylistIds((prev) => prev.filter((id) => id !== playlistId))
      showToast(`Dihapus dari playlist "${playlistTitle}"`, 'info')
      setTimeout(() => onClose(), 600)
    } else {
      // Add to playlist
      const streamSong = trackToStreamSong(track)
      addSongToPlaylist(playlistId, streamSong)
      setAddedPlaylistIds((prev) => [...prev, playlistId])

      // Also attempt server sync if applicable
      try {
        await addTrackToPlaylist(playlistId, track)
      } catch {
        // Local playlist only
      }

      showToast(`Ditambahkan ke "${playlistTitle}"`, 'success')
      setTimeout(() => onClose(), 600)
    }
  }

  const handleCreateAndAddPlaylist = async () => {
    const title = prompt('Nama playlist baru:')
    if (!title?.trim()) return
    const name = title.trim()
    const newId = crypto.randomUUID()
    const streamSong = trackToStreamSong(track)

    // Add locally to usePlaylistStore
    usePlaylistStore.setState((state) => ({
      playlists: [
        {
          id: newId,
          name,
          songs: [streamSong],
          createdAt: Date.now(),
        },
        ...state.playlists,
      ],
    }))

    // Also attempt server sync if logged in
    createPlaylist(name).then((res: any) => {
      if (res?.id) {
        addTrackToPlaylist(res.id, track).catch(() => {})
      }
    }).catch(() => {})

    setAddedPlaylistIds((prev) => [...prev, newId])
    showToast(`Playlist "${name}" dibuat & lagu ditambahkan!`, 'success')
    setTimeout(() => onClose(), 600)
  }

  const content = (
    <div
      ref={menuRef}
      style={isMobile ? undefined : { top: `${top}px`, left: `${left}px` }}
      className={
        isMobile
          ? 'w-full bg-[#181818] border-t border-white/10 rounded-t-3xl shadow-2xl p-4 text-sm text-gray-200 backdrop-blur-2xl animate-in slide-in-from-bottom duration-200'
          : 'fixed z-50 w-56 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl py-2 text-sm text-gray-200 backdrop-blur-md'
      }
      onClick={(e) => e.stopPropagation()}
    >
      {isMobile && (
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
      )}

      {/* Header track title */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-white/10 mb-2">
        {track.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.thumbnail}
            alt=""
            className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{track.title}</p>
          <p className="text-xs text-gray-400 truncate">{trackArtist || 'Artist'}</p>
        </div>
      </div>

      {/* Play Now */}
      <button
        onClick={handlePlayNow}
        className="w-full px-3 py-2.5 text-left hover:bg-white/10 flex items-center gap-3 rounded-lg transition-colors"
      >
        <Play size={16} className="text-[#38bdf8]" />
        <span className="font-medium">Putar Sekarang</span>
      </button>

      {/* Play Next */}
      <button
        onClick={handlePlayNext}
        className="w-full px-3 py-2.5 text-left hover:bg-white/10 flex items-center gap-3 rounded-lg transition-colors"
      >
        <ListOrdered size={16} className="text-gray-300" />
        <span className="font-medium">Putar Berikutnya</span>
      </button>

      {/* Add to Queue */}
      <button
        onClick={handleAddToQueue}
        className="w-full px-3 py-2.5 text-left hover:bg-white/10 flex items-center gap-3 rounded-lg transition-colors"
      >
        <ListPlus size={16} className="text-gray-300" />
        <span className="font-medium">Tambah ke Antrean</span>
      </button>

      {/* Like / Unlike */}
      <button
        onClick={handleToggleLike}
        className="w-full px-3 py-2.5 text-left hover:bg-white/10 flex items-center gap-3 rounded-lg transition-colors"
      >
        <Heart size={16} className={liked ? 'text-red-500 fill-current' : 'text-gray-300'} />
        <span className="font-medium">{liked ? 'Batal Suka' : 'Suka'}</span>
      </button>

      <div className="my-1.5 border-t border-white/5" />

      {/* Add to Playlist */}
      <div
        className="relative"
        onMouseEnter={() => !isMobile && setShowPlaylistsSubmenu(true)}
        onMouseLeave={() => !isMobile && setShowPlaylistsSubmenu(false)}
      >
        <button
          onClick={() => setShowPlaylistsSubmenu((prev) => !prev)}
          className="w-full px-3 py-2.5 text-left hover:bg-white/10 flex items-center justify-between rounded-lg transition-colors"
        >
          <div className="flex items-center gap-3">
            <Music size={16} className="text-gray-300" />
            <span className="font-medium">Tambah ke Playlist</span>
          </div>
          <ChevronRight size={16} className={`text-gray-400 transition-transform ${showPlaylistsSubmenu ? 'rotate-90 sm:rotate-0' : ''}`} />
        </button>

        {/* Submenu (Desktop popup or mobile accordion) */}
        {showPlaylistsSubmenu && (
          <div
            className={
              isMobile
                ? 'mt-2 pl-4 pr-1 space-y-1 max-h-48 overflow-y-auto'
                : 'absolute left-full top-0 ml-1 w-56 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl py-1 text-sm max-h-60 overflow-y-auto z-50'
            }
          >
            <button
              onClick={handleCreateAndAddPlaylist}
              className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-[#38bdf8] font-semibold rounded-lg border-b border-white/5"
            >
              <PlusCircle size={15} />
              <span>+ Playlist Baru</span>
            </button>

            {combinedPlaylists.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">Belum ada playlist</div>
            ) : (
              combinedPlaylists.map((pl) => {
                const isAlreadyIn = isTrackInPlaylist(pl.id)
                return (
                  <button
                    key={pl.id}
                    onClick={() => handleTogglePlaylistTrack(pl.id, pl.title)}
                    className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between rounded-lg transition-colors group"
                  >
                    <span className="truncate group-hover:text-white">{pl.title}</span>
                    {isAlreadyIn && (
                      <div className="flex items-center gap-1 text-[#38bdf8] shrink-0 ml-1.5" title="Sudah ada di playlist ini">
                        <Check size={16} strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end"
        onClick={onClose}
      >
        {content}
      </div>
    )
  }

  return content
}
