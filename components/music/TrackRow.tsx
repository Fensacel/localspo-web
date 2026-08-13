'use client'

import { Play, Heart, MoreHorizontal } from 'lucide-react'
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

export function TrackRow({ track, index, onPlay, showAlbum = false, hideDuration = false }: TrackRowProps) {
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
    setMenuPosition({ x: rect.left, y: rect.bottom + 4 })
  }

  return (
    <>
      <div
        className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors ${isActive ? 'bg-white/10' : ''}`}
        onDoubleClick={handlePlay}
        onContextMenu={handleContextMenu}
      >
      {/* Index / play button */}
      <div className="w-8 text-center shrink-0">
        {index !== undefined ? (
          <span className={`group-hover:hidden text-sm ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
            {isActive && isPlaying ? '▶' : index}
          </span>
        ) : null}
        <button
          onClick={handlePlay}
          className={`${index !== undefined ? 'hidden group-hover:flex' : 'flex'} items-center justify-center text-white`}
          aria-label={`Play ${track.title}`}
        >
          <Play size={14} fill="currentColor" />
        </button>
      </div>

      {/* Thumbnail */}
      <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-[#2a2a2a] flex items-center justify-center">
        {thumb && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={track.title}
            width={40}
            height={40}
            className="object-cover w-full h-full"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-gray-600 text-lg">♪</span>
        )}
      </div>

      {/* Title & artist */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-400' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {track.artist?.name}
          {showAlbum && track.album?.name && ` · ${track.album.name}`}
        </p>
      </div>

      {/* Duration */}
      {!hideDuration && (
        <span className="text-xs text-gray-500 shrink-0">
          {track.duration ? formatDuration(track.duration) : '—'}
        </span>
      )}

      {/* Like */}
      <button
        className={`hover:text-red-400 transition-opacity shrink-0 ${
          liked ? 'text-red-500 opacity-100' : 'text-gray-600 opacity-0 group-hover:opacity-100'
        }`}
        aria-label={liked ? 'Unlike' : 'Like'}
        onClick={(e) => {
          e.stopPropagation()
          toggleLike(track)
        }}
      >
        <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
      </button>

      {/* More options (3 dots menu button) */}
      <button
        className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-white/10"
        aria-label="More options"
        onClick={handleDotsClick}
      >
        <MoreHorizontal size={16} />
      </button>
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
