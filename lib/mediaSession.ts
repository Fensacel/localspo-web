import type { StreamSong } from '@/types/streamSong'

export interface PlayerActions {
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onSeek: (time: number) => void
}

function getAbsoluteUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
  }
  return url
}

export function updateMediaSession(
  track: StreamSong | null,
  playerActions: PlayerActions
) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return
  if (!track) return

  const artistName =
    typeof track.artist === 'string'
      ? track.artist
      : (track.artist as { name?: string })?.name || 'Unknown Artist'

  const artworkSrc = getAbsoluteUrl(track.coverUrl || track.thumbnailUrl || '/logo.png')

  const artwork: MediaImage[] = [
    { src: artworkSrc, sizes: '96x96', type: 'image/png' },
    { src: artworkSrc, sizes: '128x128', type: 'image/png' },
    { src: artworkSrc, sizes: '192x192', type: 'image/png' },
    { src: artworkSrc, sizes: '256x256', type: 'image/png' },
    { src: artworkSrc, sizes: '512x512', type: 'image/png' },
  ]

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Untitled Track',
      artist: artistName,
      album: track.album || 'LocalSpo',
      artwork,
    })
  } catch (err) {
    console.warn('[MediaSession] Failed to set metadata:', err)
  }

  // Register standard action handlers
  try {
    navigator.mediaSession.setActionHandler('play', playerActions.onPlay)
    navigator.mediaSession.setActionHandler('pause', playerActions.onPause)
    navigator.mediaSession.setActionHandler('nexttrack', playerActions.onNext)
    navigator.mediaSession.setActionHandler('previoustrack', playerActions.onPrevious)
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        playerActions.onSeek(details.seekTime)
      }
    })
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skipTime = details.seekOffset || 10
      playerActions.onSeek(Math.max(0, -skipTime))
    })
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skipTime = details.seekOffset || 10
      playerActions.onSeek(skipTime)
    })
    navigator.mediaSession.setActionHandler('stop', playerActions.onPause)
  } catch (err) {
    console.warn('[MediaSession] Failed to register action handlers:', err)
  }
}

export function updatePlaybackState(state: 'playing' | 'paused' | 'none') {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.playbackState = state
  } catch {}
}

export function updatePositionState(
  duration: number,
  position: number,
  playbackRate = 1
) {
  if (
    typeof window === 'undefined' ||
    !('mediaSession' in navigator) ||
    typeof navigator.mediaSession.setPositionState !== 'function'
  ) {
    return
  }

  if (
    duration > 0 &&
    !isNaN(duration) &&
    isFinite(duration) &&
    position >= 0 &&
    !isNaN(position) &&
    isFinite(position)
  ) {
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(position, duration),
        playbackRate: playbackRate || 1,
      })
    } catch {}
  }
}

export function clearMediaSession() {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.playbackState = 'none'
    navigator.mediaSession.metadata = null
  } catch {}
}
