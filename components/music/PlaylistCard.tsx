'use client'

import { Play, Pause, Trash2, Volume2 } from 'lucide-react'
import { useState } from 'react'

interface PlaylistCardProps {
  title: string
  subtitle?: string
  imageUrl?: string
  isPlaying?: boolean
  onClick?: () => void
  onPlayClick?: () => void
  onDelete?: () => void
}

export function PlaylistCard({
  title,
  subtitle,
  imageUrl,
  isPlaying = false,
  onClick,
  onPlayClick,
  onDelete,
}: PlaylistCardProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group cursor-pointer relative" onClick={onClick}>
      <div className={`relative aspect-square rounded-xl overflow-hidden bg-[#1e1e1e] mb-3 transition-all duration-300 ${
        isPlaying ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''
      }`}>
        {imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700">🎵</div>
        )}

        {/* Live Playing Indicator Badge */}
        {isPlaying && (
          <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/70 backdrop-blur-md border border-blue-500/40 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse">
            <Volume2 size={12} className="text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400 tracking-wider uppercase">Playing</span>
          </div>
        )}

        {onDelete && (
          <button
            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md backdrop-blur-sm z-10"
            aria-label={`Hapus ${title}`}
            title="Hapus Playlist"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 size={15} />
          </button>
        )}

        {/* Floating Play / Pause Action Button */}
        <button
          className={`absolute bottom-2 right-2 w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg z-10 ${
            isPlaying
              ? 'opacity-100 translate-y-0 scale-105 shadow-blue-600/40'
              : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'
          }`}
          aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
          onClick={(e) => {
            e.stopPropagation()
            if (onPlayClick) {
              onPlayClick()
            } else {
              onClick?.()
            }
          }}
        >
          {isPlaying ? (
            <Pause size={16} fill="white" className="text-white" />
          ) : (
            <Play size={16} fill="white" className="text-white ml-0.5" />
          )}
        </button>
      </div>
      <p className={`text-sm font-semibold truncate transition-colors ${
        isPlaying ? 'text-blue-400' : 'text-white group-hover:text-white'
      }`}>
        {title}
      </p>
      {subtitle && <p className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</p>}
    </div>
  )
}
