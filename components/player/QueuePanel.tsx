'use client'

import { usePlayerStore } from '@/store/playerStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { Play, MoreHorizontal, X, Trash2 } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useState } from 'react'
import type { Track } from '@/types/track'
import { TrackContextMenu } from '@/components/music/TrackContextMenu'

function QueueItem({
  track,
  isActive = false,
  onPlay,
  onRemove,
}: {
  track: Track
  isActive?: boolean
  onPlay: () => void
  onRemove?: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const thumb = track.thumbnail ?? track.thumbnailUrl

  return (
    <>
      <div
        onClick={onPlay}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMenuPos({ x: e.clientX, y: e.clientY })
        }}
        className={`group flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
          isActive ? 'bg-white/5' : ''
        }`}
      >
        {/* Album Artwork with Play Overlay */}
        <div className="relative w-11 h-11 shrink-0 rounded-md overflow-hidden bg-[#242424]">
          {thumb && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={track.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
              ♪
            </div>
          )}

          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Play size={16} fill="white" className="text-white ml-0.5" />
          </div>
        </div>

        {/* Track Title & Artist */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold truncate ${
              isActive ? 'text-blue-400 font-bold' : 'text-white'
            }`}
          >
            {track.title}
          </p>
          <p className="text-xs text-[#a7a7a7] truncate mt-0.5">
            {track.artist?.name || 'Unknown Artist'}
          </p>
        </div>

        {/* Options Button */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              setMenuPos({ x: rect.left, y: rect.bottom + 4 })
            }}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Pilihan lainnya"
          >
            <MoreHorizontal size={16} />
          </button>
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors"
              title="Hapus dari antrean"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {menuPos && (
        <TrackContextMenu
          track={track}
          position={menuPos}
          onClose={() => setMenuPos(null)}
        />
      )}
    </>
  )
}

export function QueuePanel() {
  const {
    currentTrack,
    queue,
    userQueue,
    contextTitle,
    currentIndex,
    removeFromQueue,
    removeFromUserQueue,
    clearUserQueue,
    clearQueue,
    play,
  } = usePlayerStore()
  const { playlists: localPlaylists } = usePlaylistStore()
  const { setQueueOpen } = useUIStore()

  const upcomingTracks = queue.slice(currentIndex + 1)

  // Determine the display context name
  let displayContextName = ''
  if (contextTitle && contextTitle.toLowerCase() !== 'playlist') {
    displayContextName = contextTitle
  } else {
    const matchedPlaylist = localPlaylists.find(
      (pl) =>
        (currentTrack &&
          pl.songs.some(
            (s) => s.id === currentTrack.id || s.title === currentTrack.title
          )) ||
        (queue.length > 0 &&
          pl.songs.some((s) => queue.some((q) => q.id === s.id || q.title === s.title)))
    )
    if (matchedPlaylist) {
      displayContextName = matchedPlaylist.name
    } else if (currentTrack?.album?.name) {
      displayContextName = currentTrack.album.name
    } else {
      displayContextName = 'playlist'
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#121212] border-l border-[#282828] w-80 shrink-0 z-20 overflow-hidden font-sans animate-in slide-in-from-right duration-300 ease-out">
      {/* Header */}
      <div className="p-4 border-b border-[#282828] flex items-center justify-between">
        <h2 className="text-base font-bold text-white tracking-tight">Antrean</h2>
        <div className="flex items-center gap-2">
          {(queue.length > 0 || userQueue.length > 0) && (
            <button
              onClick={clearQueue}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
              title="Hapus semua antrean"
            >
              <Trash2 size={14} /> Hapus
            </button>
          )}
          <button
            onClick={() => setQueueOpen(false)}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#282828] transition-colors"
            aria-label="Tutup antrean"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-6">
        {/* 1. Sekarang Memutar */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Sekarang memutar
          </h3>
          {currentTrack ? (
            <QueueItem
              track={currentTrack}
              isActive={true}
              onPlay={() => play(currentTrack, queue, currentIndex, displayContextName)}
            />
          ) : (
            <p className="text-xs text-gray-500 italic px-2">Tidak ada lagu yang sedang diputar</p>
          )}
        </section>

        {/* 2. Berikutnya dalam antrean (Manual Queue) */}
        {userQueue.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Berikutnya dalam antrean
              </h3>
              <button
                onClick={clearUserQueue}
                className="text-xs font-semibold text-gray-400 hover:text-white transition-colors"
              >
                Hapus antrean
              </button>
            </div>

            <div className="space-y-1">
              {userQueue.map((track, i) => (
                <QueueItem
                  key={`user-${track.id}-${i}`}
                  track={track}
                  onPlay={() => {
                    usePlayerStore.setState((s) => ({
                      currentTrack: track,
                      userQueue: s.userQueue.filter((_, idx) => idx !== i),
                      isPlaying: true,
                      currentTime: 0,
                      duration: 0,
                      seekTo: null,
                    }))
                  }}
                  onRemove={() => removeFromUserQueue(i)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 3. Berikutnya dari: [Nama Playlist] */}
        {upcomingTracks.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight truncate">
                Berikutnya dari: {displayContextName}
              </h3>
            </div>

            <div className="space-y-1">
              {upcomingTracks.map((track, i) => {
                const actualIndex = currentIndex + 1 + i
                return (
                  <QueueItem
                    key={`playlist-${track.id}-${i}`}
                    track={track}
                    onPlay={() => play(track, queue, actualIndex, displayContextName)}
                    onRemove={() => removeFromQueue(actualIndex)}
                  />
                )
              })}
            </div>
          </section>
        )}

        {upcomingTracks.length === 0 && userQueue.length === 0 && currentTrack && (
          <div className="text-xs text-gray-500 italic px-2 py-4">
            Tidak ada lagu berikutnya di antrean
          </div>
        )}
      </div>
    </div>
  )
}
