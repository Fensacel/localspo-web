'use client'

import Link from 'next/link'
import { Play } from 'lucide-react'
import { useState } from 'react'

interface AlbumCardProps {
  title: string
  subtitle?: string
  imageUrl?: string
  onClick?: () => void
  href?: string
}

export function AlbumCard({ title, subtitle, imageUrl, onClick, href }: AlbumCardProps) {
  const [imgError, setImgError] = useState(false)

  const content = (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="relative aspect-square rounded-lg overflow-hidden bg-[#1e1e1e] mb-3">
        {imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700">♪</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        <button
          className="absolute bottom-2 right-2 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 shadow-lg"
          aria-label={`Play ${title}`}
          onClick={(e) => { e.stopPropagation(); onClick?.() }}
        >
          <Play size={16} fill="white" className="text-white ml-0.5" />
        </button>
      </div>
      <p className="text-sm font-medium truncate">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</p>}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}
