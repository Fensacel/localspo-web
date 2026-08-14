import type { StreamSong } from '@/types/streamSong'
import type { Track } from '@/types/track'
import { scoreTrackMatch, normalizeString } from '@/lib/matcher'
import { useLibraryStore } from '@/store/useLibraryStore'
import { usePlayerStore } from '@/store/playerStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { preloadQueue, isYouTubeVideoId } from '@/lib/queuePreloader'

export function pickBestMatch(
  candidateSongs: Track[],
  song: { id?: string; title: string; artist: string; durationMs: number }
): Track | null {
  if (!candidateSongs || candidateSongs.length === 0) return null

  let bestMatch: Track | null = null
  let bestScore = 0

  for (const candidate of candidateSongs) {
    const { score } = scoreTrackMatch(
      {
        title: song.title,
        artist: song.artist,
        durationMs: song.durationMs,
      },
      candidate,
      0.45
    )

    if (score > bestScore) {
      bestScore = score
      bestMatch = candidate
    }
  }

  if (bestMatch && bestScore >= 0.40) {
    return bestMatch
  }

  // Fallback to first candidate only if it has compatible title keywords
  if (candidateSongs.length > 0) {
    const firstCandidate = candidateSongs[0]
    const normTarget = normalizeString(song.title)
    const normCand = normalizeString(firstCandidate.title)
    if (normCand.includes(normTarget) || normTarget.includes(normCand) || bestScore >= 0.25) {
      return firstCandidate
    }
  }

  return bestMatch || candidateSongs[0] || null
}

let currentPlayRequestId = 0

/**
 * Plays a StreamSong immediately, resolving YouTube video ID with race-condition protection,
 * and launches background preloading for the entire playlist queue.
 */
export async function playSong(
  song: StreamSong,
  queue?: StreamSong[],
  index?: number,
  contextTitle?: string
): Promise<void> {
  const requestId = ++currentPlayRequestId

  const librarySong = useLibraryStore.getState().allSongs[song.id]
  const resolvedLibId = librarySong?.resolvedVideoId
  let videoId =
    (isYouTubeVideoId(song.resolvedVideoId) ? song.resolvedVideoId : undefined) ||
    (isYouTubeVideoId(resolvedLibId) ? resolvedLibId : undefined) ||
    (isYouTubeVideoId(song.videoId) ? song.videoId : undefined)

  const trackToPlay: Track = {
    id: song.id,
    videoId,
    title: song.title,
    artist: { name: song.artist },
    album: song.album ? { name: song.album } : undefined,
    duration: Math.round(song.durationMs / 1000),
    thumbnail: song.coverUrl,
    thumbnailUrl: song.coverUrl,
    source: 'spotify',
  }

  const trackQueue: Track[] = (queue || [song]).map((s) => {
    const libEntry = useLibraryStore.getState().allSongs[s.id]
    const resolvedId =
      (isYouTubeVideoId(s.resolvedVideoId) ? s.resolvedVideoId : undefined) ||
      (isYouTubeVideoId(libEntry?.resolvedVideoId) ? libEntry?.resolvedVideoId : undefined) ||
      (isYouTubeVideoId(s.videoId) ? s.videoId : undefined) ||
      (s.id === song.id ? videoId : undefined)
    return {
      id: s.id,
      videoId: resolvedId,
      title: s.title,
      artist: { name: s.artist },
      album: s.album ? { name: s.album } : undefined,
      duration: Math.round(s.durationMs / 1000),
      thumbnail: s.coverUrl,
      thumbnailUrl: s.coverUrl,
      source: 'spotify' as const,
    }
  })

  const playIndex =
    index !== undefined && index >= 0
      ? index
      : queue
      ? queue.findIndex((q) => q.id === song.id)
      : 0

  // 1. Immediately switch playback state in store so UI reacts instantly without waiting
  usePlayerStore
    .getState()
    .play(trackToPlay, trackQueue, playIndex >= 0 ? playIndex : 0, contextTitle)

  // 2. Launch background preloader for the upcoming playlist tracks
  if (queue && queue.length > 1) {
    setTimeout(() => {
      preloadQueue(queue, playIndex + 1)
    }, 200)
  }

  // 3. If current song videoId is missing, resolve it with high priority
  if (!videoId) {
    try {
      const query = `${song.title} ${song.artist}`
      const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=songs`)
      if (requestId !== currentPlayRequestId) return // Discard stale request

      const searchJson = await searchRes.json()
      if (requestId !== currentPlayRequestId) return // Discard stale request

      const songsList: Track[] = searchJson.data?.songs || []
      const topResult: Track | null = searchJson.data?.topResult?.data || null
      const candidates: Track[] = topResult ? [topResult, ...songsList] : songsList

      const matchedTrack = pickBestMatch(candidates, song)
      const bestVideoId = matchedTrack?.videoId || matchedTrack?.id

      if (bestVideoId) {
        if (requestId !== currentPlayRequestId) return // Discard stale request
        videoId = bestVideoId
        useLibraryStore.getState().updateResolvedVideoId(song.id, bestVideoId)
        usePlayerStore.getState().updateQueueSongVideoId(song.id, bestVideoId)
        usePlaylistStore.getState().updateSongResolvedVideoId?.(song.id, bestVideoId)
      }
    } catch (err) {
      console.error('[playSong] Search error resolving videoId:', err)
    }
  }
}
