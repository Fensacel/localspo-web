'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, ListPlus, PlusCircle, Heart, Music, ListOrdered, ChevronRight, Check } from 'lucide-react'
import { Track } from '@/types/track'
import { usePlayerStore } from '@/store/playerStore'
import { useLikedTracks } from '@/lib/hooks/useLikedTracks'
import { usePlaylists } from '@/lib/hooks/usePlaylists'

interface ContextMenuPosition {
  x: number
  y: number
}

interface TrackContextMenuProps {
  track: Track
  position: ContextMenuPosition | null
  onClose: () => void
}

export function TrackContextMenu({ track, position, onClose }: TrackContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { play, addToQueue, playNext } = usePlayerStore()
  const { isLiked, toggleLike } = useLikedTracks()
  const { playlists, addTrackToPlaylist, createPlaylist } = usePlaylists()

  const [showPlaylistsSubmenu, setShowPlaylistsSubmenu] = useState(false)
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<string[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const liked = isLiked(track.id)

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

  // Ensure menu stays within screen bounds
  const menuWidth = 220
  const menuHeight = 260
  const left = Math.min(position.x, window.innerWidth - menuWidth - 10)
  const top = Math.min(position.y, window.innerHeight - menuHeight - 10)

  const handlePlayNow = () => {
    play(track)
    onClose()
  }

  const handlePlayNext = () => {
    playNext(track)
    showToast('Ditambahkan ke putar berikutnya')
    setTimeout(() => onClose(), 800)
  }

  const handleAddToQueue = () => {
    addToQueue(track)
    showToast('Ditambahkan ke antrean')
    setTimeout(() => onClose(), 800)
  }

  const handleToggleLike = () => {
    toggleLike(track)
    onClose()
  }

  const handleAddToPlaylist = async (playlistId: string, playlistTitle: string) => {
    try {
      await addTrackToPlaylist(playlistId, track)
      setAddedPlaylistIds((prev) => [...prev, playlistId])
      showToast(`Ditambahkan ke "${playlistTitle}"`)
      setTimeout(() => onClose(), 1000)
    } catch (err) {
      console.error('Failed to add to playlist:', err)
      showToast('Gagal menambahkan ke playlist')
    }
  }

  const handleCreateAndAddPlaylist = async () => {
    const title = prompt('Nama playlist baru:')
    if (!title?.trim()) return
    try {
      const newPlaylist = await createPlaylist(title.trim())
      if (newPlaylist?.id) {
        await addTrackToPlaylist(newPlaylist.id, track)
        showToast(`Playlist "${title}" dibuat & lagu ditambahkan`)
      } else {
        showToast(`Playlist "${title}" dibuat`)
      }
      setTimeout(() => onClose(), 1000)
    } catch (err) {
      console.error('Failed to create playlist:', err)
      showToast('Gagal membuat playlist')
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
  }

  return (
    <div
      ref={menuRef}
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 w-56 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl py-2 text-sm text-gray-200 backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      {toastMessage ? (
        <div className="px-4 py-2 text-xs font-medium text-blue-400 flex items-center gap-2">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      ) : (
        <>
          {/* Header track title */}
          <div className="px-3 py-1.5 border-b border-white/5 mb-1">
            <p className="text-xs font-semibold text-white truncate">{track.title}</p>
            <p className="text-[11px] text-gray-400 truncate">{track.artist?.name}</p>
          </div>

          {/* Play Now */}
          <button
            onClick={handlePlayNow}
            className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2.5 transition-colors"
          >
            <Play size={15} className="text-gray-400" />
            <span>Putar Sekarang</span>
          </button>

          {/* Play Next */}
          <button
            onClick={handlePlayNext}
            className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2.5 transition-colors"
          >
            <ListOrdered size={15} className="text-gray-400" />
            <span>Putar Berikutnya</span>
          </button>

          {/* Add to Queue */}
          <button
            onClick={handleAddToQueue}
            className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2.5 transition-colors"
          >
            <ListPlus size={15} className="text-gray-400" />
            <span>Tambah ke Antrean</span>
          </button>

          {/* Like / Unlike */}
          <button
            onClick={handleToggleLike}
            className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2.5 transition-colors"
          >
            <Heart size={15} className={liked ? 'text-red-500 fill-current' : 'text-gray-400'} />
            <span>{liked ? 'Batal Suka' : 'Suka'}</span>
          </button>

          <div className="my-1 border-t border-white/5" />

          {/* Add to Playlist Submenu trigger */}
          <div
            className="relative"
            onMouseEnter={() => setShowPlaylistsSubmenu(true)}
            onMouseLeave={() => setShowPlaylistsSubmenu(false)}
          >
            <button
              onClick={() => setShowPlaylistsSubmenu((prev) => !prev)}
              className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Music size={15} className="text-gray-400" />
                <span>Tambah ke Playlist</span>
              </div>
              <ChevronRight size={14} className="text-gray-400" />
            </button>

            {/* Submenu */}
            {showPlaylistsSubmenu && (
              <div className="absolute left-full top-0 ml-1 w-52 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl py-1 text-sm max-h-60 overflow-y-auto">
                <button
                  onClick={handleCreateAndAddPlaylist}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-blue-400 font-medium border-b border-white/5"
                >
                  <PlusCircle size={15} />
                  <span>+ Playlist Baru</span>
                </button>

                {playlists.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">Belum ada playlist</div>
                ) : (
                  playlists.map((pl) => {
                    const isAdded = addedPlaylistIds.includes(pl.id)
                    return (
                      <button
                        key={pl.id}
                        onClick={() => handleAddToPlaylist(pl.id, pl.title)}
                        className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between truncate"
                      >
                        <span className="truncate">{pl.title}</span>
                        {isAdded && <Check size={14} className="text-green-400 shrink-0 ml-1" />}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
