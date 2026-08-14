'use client'

import { Play, Pause, Volume2 } from 'lucide-react'
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
}: PlaylistCardProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group cursor-pointer relative select-none" onClick={onClick}>
      <div
        className={`relative aspect-square rounded-2xl overflow-hidden bg-[#181818] mb-2.5 transition-all duration-300 shadow-md ${
          isPlaying ? 'ring-2 ring-[#38bdf8] shadow-lg shadow-[#38bdf8]/20' : 'group-hover:shadow-xl'
        }`}
      >
        {imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700 bg-gradient-to-br from-[#222] to-[#121212]">
            🎵
          </div>
        )}

        {/* Live Playing Indicator Badge */}
        {isPlaying && (
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/80 backdrop-blur-md border border-[#38bdf8]/40 rounded-full flex items-center gap-1.5 shadow-lg">
            <Volume2 size={11} className="text-[#38bdf8] animate-pulse" />
            <span className="text-[9px] font-extrabold text-[#38bdf8] tracking-wider uppercase">Playing</span>
          </div>
        )}

        {/* Floating Desktop Hover Play Button */}
        <button
          className={`hidden sm:flex absolute bottom-2.5 right-2.5 w-11 h-11 bg-[#38bdf8] text-black rounded-full items-center justify-center transition-all duration-300 shadow-xl z-10 hover:scale-105 active:scale-95 ${
            isPlaying
              ? 'opacity-100 translate-y-0 scale-100'
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
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>
      </div>

      <p
        className={`text-sm font-bold truncate leading-tight transition-colors ${
          isPlaying ? 'text-[#38bdf8]' : 'text-white group-hover:text-white'
        }`}
      >
        {title}
      </p>
      {subtitle && <p className="text-xs text-gray-400 truncate mt-1">{subtitle}</p>}
    </div>
  )
}
