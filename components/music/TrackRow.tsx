'use client'

import { Heart, MoreVertical } from 'lucide-react'
import { Track } from '@/types/track'
import { formatDuration } from '@/lib/utils/formatDuration'
import { usePlayerStore } from '@/store/playerStore'
import { useLikedTracks } from '@/lib/hooks/useLikedTracks'
import { useState } from 'react'
import { TrackContextMenu } from './TrackContextMenu'

interface TrackRowProps {
  track: Track
  index?: number
  onPlay?: () => void
  showAlbum?: boolean
  hideDuration?: boolean
}

export function TrackRow({ track, onPlay, showAlbum = false, hideDuration = false }: TrackRowProps) {
  const { currentTrack, isPlaying } = usePlayerStore()
  const { isLiked, toggleLike } = useLikedTracks()
  const [imgError, setImgError] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)

  const isActive = currentTrack?.id === track.id
  const liked = isLiked(track.id)
  const thumb = track.thumbnail ?? track.thumbnailUrl

  function handlePlay() {
    onPlay?.()
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuPosition({ x: e.clientX, y: e.clientY })
  }

  function handleDotsClick(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPosition({ x: rect.left - 100, y: rect.bottom + 4 })
  }

  return (
    <>
      <div
        className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl cursor-pointer hover:bg-white/5 active:scale-[0.99] transition-all select-none ${
          isActive ? 'bg-white/10' : ''
        }`}
        onClick={handlePlay}
        onContextMenu={handleContextMenu}
      >
        {/* Left Side: Thumbnail + Title & Artist */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Thumbnail */}
          <div className="relative w-11 h-11 shrink-0 rounded-xl overflow-hidden bg-[#242424] flex items-center justify-center border border-white/10 shadow-sm">
            {thumb && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt={track.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-gray-600 text-base">♪</span>
            )}
            {isActive && isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-xs text-[#38bdf8] font-bold animate-pulse">▶</span>
              </div>
            )}
          </div>

          {/* Title & Artist */}
          <div className="min-w-0 flex-1">
            <p
              className={`text-xs sm:text-sm font-bold truncate leading-tight transition-colors ${
                isActive ? 'text-[#38bdf8]' : 'text-white group-hover:text-[#38bdf8]'
              }`}
            >
              {track.title}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-400 truncate leading-tight mt-0.5">
              {typeof track.artist === 'string' ? track.artist : track.artist?.name || 'Unknown Artist'}
              {showAlbum && track.album?.name && ` • ${track.album.name}`}
            </p>
          </div>
        </div>

        {/* Right Side: Duration + Like + 3-Dots */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Duration */}
          {!hideDuration && track.duration && (
            <span className="text-[11px] font-mono text-gray-400">
              {formatDuration(track.duration)}
            </span>
          )}

          {/* Like Heart */}
          <button
            className={`p-1 transition-all active:scale-90 ${
              liked ? 'text-red-500 opacity-100' : 'text-gray-500 opacity-0 group-hover:opacity-100'
            }`}
            aria-label={liked ? 'Unlike' : 'Like'}
            onClick={(e) => {
              e.stopPropagation()
              toggleLike(track)
            }}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          </button>

          {/* 3-Dots Menu Button */}
          <button
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Opsi lagu"
            title="Opsi lagu"
            onClick={handleDotsClick}
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {menuPosition && (
        <TrackContextMenu
          track={track}
          position={menuPosition}
          onClose={() => setMenuPosition(null)}
        />
      )}
    </>
  )
}
