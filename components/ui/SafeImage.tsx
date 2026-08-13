'use client'

import React, { useState } from 'react'

interface SafeImageProps {
  src?: string | null
  alt: string
  width?: number
  height?: number
  className?: string
  fallback?: React.ReactNode
  priority?: boolean
}

/**
 * SafeImage — plain <img> with onError fallback.
 * Used for dynamic external URLs (YouTube Music thumbnails, etc.)
 * that cannot be statically added to next.config remotePatterns.
 */
export function SafeImage({ src, alt, width, height, className, fallback, priority }: SafeImageProps) {
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return <>{fallback ?? null}</>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setErrored(true)}
    />
  )
}
