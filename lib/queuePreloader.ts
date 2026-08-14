import type { Track } from '@/types/track'
import type { StreamSong } from '@/types/streamSong'
import { pickBestMatch } from '@/lib/playSong'
import { useLibraryStore } from '@/store/useLibraryStore'
import { usePlayerStore } from '@/store/playerStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'

const preloadingSet = new Set<string>()
const preloadedAudioStreams = new Set<string>()

export function isYouTubeVideoId(id?: string | null): boolean {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id)
}

function getCachedWarmedStreams(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem('localspo_warmed_streams')
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveWarmedStream(videoId: string) {
  if (typeof window === 'undefined') return
  try {
    const current = getCachedWarmedStreams()
    current.add(videoId)
    sessionStorage.setItem('localspo_warmed_streams', JSON.stringify(Array.from(current)))
  } catch {}
}

/**
 * Pre-fetches and warms up the audio stream in browser memory/cache for zero-latency playback.
 * Strictly verifies 11-char YouTube video ID to prevent 400 errors with Spotify IDs.
 */
export function preloadAudioStream(videoId: string) {
  if (!videoId || !isYouTubeVideoId(videoId) || preloadedAudioStreams.has(videoId) || getCachedWarmedStreams().has(videoId)) return
  preloadedAudioStreams.add(videoId)
  saveWarmedStream(videoId)

  try {
    fetch(`/api/stream/${videoId}`, {
      headers: { Range: 'bytes=0-524288' },
    }).catch(() => {})
  } catch {}
}

/**
 * Resolves a single song's YouTube video ID in the background and stores it permanently.
 */
export async function preloadSingleSong(
  song: { id: string; title: string; artist: string | { name?: string }; duration?: number; durationMs?: number; videoId?: string; resolvedVideoId?: string }
): Promise<string | null> {
  const songId = song.id
  if (!songId) return null

  const libResolved = useLibraryStore.getState().allSongs[songId]?.resolvedVideoId
  const existingVideoId =
    (isYouTubeVideoId(song.resolvedVideoId) ? song.resolvedVideoId : null) ||
    (isYouTubeVideoId(libResolved) ? libResolved : null) ||
    (isYouTubeVideoId(song.videoId) ? song.videoId : null)

  if (existingVideoId) {
    preloadAudioStream(existingVideoId)
    return existingVideoId
  }

  if (preloadingSet.has(songId)) {
    return null
  }

  preloadingSet.add(songId)

  try {
    const artistName = typeof song.artist === 'string' ? song.artist : song.artist?.name || ''
    const durationMs = song.durationMs ?? (song.duration ? song.duration * 1000 : 0)
    const query = `${song.title} ${artistName}`

    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=songs`)
    const json = await res.json()
    const songsList: Track[] = json.data?.songs || []
    const topResult: Track | null = json.data?.topResult?.data || null
    const candidates: Track[] = topResult ? [topResult, ...songsList] : songsList

    const matched = pickBestMatch(candidates, {
      id: songId,
      title: song.title,
      artist: artistName,
      durationMs,
    })

    const bestVideoId = matched?.videoId || matched?.id
    if (bestVideoId && isYouTubeVideoId(bestVideoId)) {
      useLibraryStore.getState().updateResolvedVideoId(songId, bestVideoId)
      usePlayerStore.getState().updateQueueSongVideoId(songId, bestVideoId)
      usePlaylistStore.getState().updateSongResolvedVideoId?.(songId, bestVideoId)
      preloadAudioStream(bestVideoId)
      return bestVideoId
    }
  } catch (err) {
    console.error('[Preloader] Error resolving song:', song.title, err)
  } finally {
    preloadingSet.delete(songId)
  }

  return null
}

/**
 * Preloads, resolves video IDs, and warms up streams for ALL songs in a playlist queue.
 */
export async function preloadQueue(
  tracks: (Track | StreamSong)[],
  startIndex = 0
) {
  if (!tracks || tracks.length === 0) return

  const upcoming = tracks.slice(startIndex)
  const previous = tracks.slice(0, startIndex)
  const prioritizedQueue = [...upcoming, ...previous]

  const CONCURRENCY = 4
  let activeIndex = 0

  async function worker() {
    while (activeIndex < prioritizedQueue.length) {
      const track = prioritizedQueue[activeIndex++]
      if (!track) continue

      const artistName =
        typeof track.artist === 'string'
          ? track.artist
          : track.artist?.name || ''

      const videoId = await preloadSingleSong({
        id: track.id,
        title: track.title,
        artist: artistName,
        duration: 'duration' in track ? track.duration : undefined,
        durationMs: 'durationMs' in track ? track.durationMs : undefined,
        videoId: 'videoId' in track ? track.videoId : undefined,
        resolvedVideoId: 'resolvedVideoId' in track ? track.resolvedVideoId : undefined,
      })

      if (videoId && isYouTubeVideoId(videoId)) {
        preloadAudioStream(videoId)
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, prioritizedQueue.length) }, () => worker())
  await Promise.allSettled(workers)
}
