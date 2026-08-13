'use client'

import { useState } from 'react'

interface ArtistCardProps {
  name: string
  imageUrl?: string
  onClick?: () => void
}

export function ArtistCard({ name, imageUrl, onClick }: ArtistCardProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="group cursor-pointer text-center" onClick={onClick}>
      <div className="relative aspect-square rounded-full overflow-hidden bg-[#1e1e1e] mb-3 mx-auto max-w-[140px]">
        {imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700">👤</div>
        )}
      </div>
      <p className="text-sm font-medium truncate">{name}</p>
      <p className="text-xs text-gray-500 mt-0.5">Artist</p>
    </div>
  )
}
