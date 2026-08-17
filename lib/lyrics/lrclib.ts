import type { Lyrics } from '@/types/lyrics'
import { parseLRC } from './lrcParser'

const BASE_URL = process.env.LRCLIB_API_URL || 'https://lrclib.net/api'

interface LrclibResponse {
  id?: number
  trackName?: string
  artistName?: string
  albumName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string
  syncedLyrics?: string
}

/**
 * Strips feat/ft/featuring but preserves version qualifiers like (10 Minute Version), (Remix), etc.
 */
function cleanFeatOnly(title: string): string {
  return title
    .replace(/\s*[\(\[](?:feat|ft|featuring)\.?\s+[^\)\]]+[\)\]]/gi, '')
    .replace(/\s+feat\.?\s+.*/i, '')
    .trim()
}

function cleanExtraTags(title: string): string {
  return title
    .replace(/[\(\[\{]\s*(?:official\s+)?(?:music\s+)?(?:video|audio|mv|visualizer|lyric\s+video|lyrics|hd|4k|remastered?|deluxe)\s*[\)\]\}]/gi, '')
    .replace(/\s*[\(\[](?:feat|ft|featuring)\.?\s+[^\)\]]+[\)\]]/gi, '')
    .trim()
}

function isRomanizedText(str?: string): boolean {
  if (!str) return false
  return /romanized|romaja|romanization|\broma\b/i.test(str)
}

function hasNativeScript(text?: string): boolean {
  if (!text) return false
  return /[\uac00-\ud7a3\u3040-\u30ff\u4e00-\u9faf\u0400-\u04ff\u0e00-\u0e7f]/.test(text)
}

const VERSION_TAGS = [
  '10 minute',
  'ten minute',
  '10-minute',
  'remix',
  'live',
  'acoustic',
  'taylor\'s version',
  'extended',
  'sped up',
  'slowed',
  'instrumental',
  'orchestral',
  'version',
]

function scoreLrclibItem(
  item: LrclibResponse,
  target: { track: string; artist: string; duration?: number }
): number {
  if (!item) return -1000
  let score = 0

  const trackName = (item.trackName || '').toLowerCase()
  const albumName = (item.albumName || '').toLowerCase()
  const targetTrack = target.track.toLowerCase()
  const synced = item.syncedLyrics || ''
  const plain = item.plainLyrics || ''
  const lyricsText = synced + '\n' + plain

  // 1. Synced Lyrics absolute priority (+300)
  if (synced && parseLRC(synced).length > 0) {
    score += 300
  } else if (plain) {
    score += 20
  } else {
    return -1000
  }

  // 2. Duration Matching
  if (target.duration && item.duration) {
    const diff = Math.abs(item.duration - target.duration)
    if (diff <= 2) {
      score += 200 // Exact duration match
    } else if (diff <= 5) {
      score += 100
    } else if (diff <= 10) {
      score += 30
    } else if (diff > 25) {
      score -= 400 // Heavy penalty for wrong version length
    }
  }

  // 3. Version Keywords Matching
  for (const tag of VERSION_TAGS) {
    const targetHasTag = targetTrack.includes(tag)
    const itemHasTag = trackName.includes(tag)

    if (targetHasTag && itemHasTag) {
      score += 120
    } else if (targetHasTag && !itemHasTag) {
      score -= 250 // Target wanted version (e.g. 10 minute), but candidate is standard
    } else if (!targetHasTag && itemHasTag) {
      score -= 150 // Target is standard, candidate is remix/live
    }
  }

  // 4. Prefer Native Script (Japanese/Kanji/Kana/Hangul/Chinese) over Pure Romaji uploads
  if (isRomanizedText(trackName) || isRomanizedText(albumName)) {
    score -= 300
  }
  if (hasNativeScript(lyricsText)) {
    score += 400 // Massive bonus for original Kanji/Kana/Hangul script
  } else {
    // If lyrics text is purely Latin/ASCII (Romaji), penalize heavily so native script wins
    score -= 300
  }

  return score
}

export async function fetchLyrics(params: {
  artist: string
  track: string
  album?: string
  duration?: number
}): Promise<Lyrics | null> {
  try {
    const originalTrack = params.track.trim()
    const cleanTrack = cleanExtraTags(originalTrack)
    const cleanFeatTrack = cleanFeatOnly(originalTrack)

    let plainFallback: Lyrics | null = null

    // Strategy 1: Direct /get with exact parameters
    if (params.duration) {
      try {
        const sp = new URLSearchParams({
          artist_name: params.artist,
          track_name: cleanTrack || cleanFeatTrack,
          duration: String(Math.round(params.duration)),
        })
        if (params.album) sp.set('album_name', params.album)

        const res = await fetch(`${BASE_URL}/get?${sp.toString()}`, {
          next: { revalidate: 3600 },
        })
        if (res.ok) {
          const data: LrclibResponse = await res.json()
          const lyricsText = (data?.syncedLyrics || '') + '\n' + (data?.plainLyrics || '')
          if (data?.syncedLyrics) {
            const normalized = normalizeLrclibResponse(data)
            // Only return directly if it has native script or isn't a pure Romaji track
            if (normalized?.synced && (hasNativeScript(lyricsText) || !isRomanizedText(data.trackName))) {
              return normalized
            }
            if (normalized?.synced && !plainFallback) {
              plainFallback = normalized
            }
          } else if (data?.plainLyrics) {
            if (!plainFallback) plainFallback = normalizeLrclibResponse(data)
          }
        }
      } catch (err) {
        console.warn('LRCLIB direct /get failed:', err)
      }
    }

    // Strategy 2: Search with clean track & find synced lyrics
    const searchResult = await searchLyrics({
      artist: params.artist,
      track: cleanTrack || originalTrack,
      album: params.album,
      duration: params.duration,
    })
    if (searchResult?.synced) return searchResult

    // Strategy 3: Search with original track (keeps version tags like 10 Minute Version)
    if (cleanTrack !== originalTrack) {
      const origSearchResult = await searchLyrics({
        artist: params.artist,
        track: originalTrack,
        album: params.album,
        duration: params.duration,
      })
      if (origSearchResult?.synced) return origSearchResult
      if (origSearchResult && !searchResult) return origSearchResult
    }

    if (searchResult) return searchResult
    if (plainFallback) return plainFallback

    return null
  } catch (err) {
    console.error('[fetchLyrics error]:', err)
    return null
  }
}

async function searchLyrics(params: {
  artist: string
  track: string
  album?: string
  duration?: number
}): Promise<Lyrics | null> {
  try {
    const sp = new URLSearchParams({
      q: `${params.artist} ${params.track}`,
    })
    const res = await fetch(`${BASE_URL}/search?${sp.toString()}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null

    const results: LrclibResponse[] = await res.json()
    if (!results || !results.length) return null

    // Sort results by score (syncedLyrics has high +300 bonus and duration matching)
    const scored = results
      .map((item) => ({
        item,
        score: scoreLrclibItem(item, {
          track: params.track,
          artist: params.artist,
          duration: params.duration,
        }),
      }))
      .sort((a, b) => b.score - a.score)

    for (const { item } of scored) {
      const normalized = normalizeLrclibResponse(item)
      if (normalized) return normalized
    }

    return null
  } catch {
    return null
  }
}

function normalizeLrclibResponse(data: LrclibResponse): Lyrics | null {
  if (!data) return null

  if (data.syncedLyrics) {
    const lines = parseLRC(data.syncedLyrics)
    if (lines.length > 0) {
      return {
        synced: true,
        lines,
        plain: data.plainLyrics || data.syncedLyrics,
      }
    }
  }

  if (data.plainLyrics) {
    return {
      synced: false,
      lines: [], // No fake timestamps!
      plain: data.plainLyrics,
    }
  }

  return null
}
