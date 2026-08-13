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

function cleanTitle(title: string): string {
  return title
    .replace(/ft\..*|feat\..*/i, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .trim()
}

function isRomanizedText(str?: string): boolean {
  if (!str) return false
  return /romanized|romaja|romanization|\broma\b/i.test(str)
}

function hasNativeScript(text?: string): boolean {
  if (!text) return false
  // Check for Hangul, Kana, Kanji, Cyrillic, Thai, etc.
  return /[\uac00-\ud7a3\u3040-\u30ff\u4e00-\u9faf\u0400-\u04ff\u0e00-\u0e7f]/.test(text)
}

function scoreLrclibItem(item: LrclibResponse): number {
  if (!item) return -100
  let score = 0
  const trackName = item.trackName || ''
  const albumName = item.albumName || ''
  const synced = item.syncedLyrics || ''
  const plain = item.plainLyrics || ''
  const lyricsText = synced + '\n' + plain

  // Penalize romanized titles/albums
  if (isRomanizedText(trackName) || isRomanizedText(albumName)) {
    score -= 100
  }

  // Heavily reward native scripts (e.g. Hangul for K-Pop)
  if (hasNativeScript(lyricsText)) {
    score += 80
  }

  // Reward synced lyrics
  if (synced && parseLRC(synced).length > 0) {
    score += 30
  }

  // Reward non-empty plain lyrics
  if (plain) {
    score += 10
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
    const cleanedTrack = cleanTitle(params.track) || params.track

    // Always try search first if we want to rank non-romanized over romanized
    const searchResult = await searchLyrics({ ...params, track: cleanedTrack })
    if (searchResult) return searchResult

    // Direct /get fallback
    const sp = new URLSearchParams({
      artist_name: params.artist,
      track_name: cleanedTrack,
    })
    if (params.album) sp.set('album_name', params.album)
    if (params.duration) sp.set('duration', String(Math.round(params.duration)))

    const res = await fetch(`${BASE_URL}/get?${sp.toString()}`, {
      next: { revalidate: 3600 },
    })

    if (res.ok) {
      const data: LrclibResponse = await res.json()
      const normalized = normalizeLrclibResponse(data)
      if (normalized) return normalized
    }

    return null
  } catch {
    return null
  }
}

async function searchLyrics(params: {
  artist: string
  track: string
  album?: string
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
    if (!results.length) return null

    // Sort results by score (prefer native script and non-romanized)
    const sorted = [...results].sort((a, b) => scoreLrclibItem(b) - scoreLrclibItem(a))

    for (const item of sorted) {
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
        plain: data.plainLyrics,
      }
    }
  }

  if (data.plainLyrics) {
    const lines = data.plainLyrics
      .split('\n')
      .map((text, i) => ({ time: i * 3, text: text.trim() }))
      .filter((l) => l.text)
    return {
      synced: false,
      lines,
      plain: data.plainLyrics,
    }
  }

  return null
}
