import type { Track } from '@/types/track'

export interface SpotifyTrackInput {
  title: string
  artist: string
  album?: string
  durationMs?: number
  coverUrl?: string
}

export interface MatchResult {
  spotifyTrack: SpotifyTrackInput
  matchedTrack: Track | null
  status: 'matched' | 'not_found'
  score: number
}

/**
 * Normalizes title/artist string by removing common noise words and special characters
 */
export function normalizeString(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[\(\[\{].*?[\)\]\}]/g, '') // remove brackets e.g. (Official Video), [Remastered]
    .replace(/\b(feat|ft|featuring|remaster|remastered|official|video|audio|version|deluxe|edit|mix)\b/gi, '')
    .replace(/[^\w\s]/gi, '') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculates Dice Coefficient string similarity (0.0 to 1.0)
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeString(a)
  const normB = normalizeString(b)

  if (normA === normB) return 1.0
  if (!normA || !normB) return 0.0

  if (normA.includes(normB) || normB.includes(normA)) return 0.85

  const getBigrams = (s: string) => {
    const bigrams = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.slice(i, i + 2))
    }
    return bigrams
  }

  const bgA = getBigrams(normA)
  const bgB = getBigrams(normB)
  let intersection = 0

  for (const bg of bgA) {
    if (bgB.has(bg)) intersection++
  }

  const total = bgA.size + bgB.size
  return total > 0 ? (2 * intersection) / total : 0
}

/**
 * Matches a Spotify track to potential YouTube Music tracks and scores the best candidate
 */
export function scoreTrackMatch(
  spotify: SpotifyTrackInput,
  ytTrack: Track,
  threshold = 0.65
): { isMatch: boolean; score: number } {
  const titleScore = stringSimilarity(spotify.title, ytTrack.title)

  const ytArtistName = ytTrack.artist?.name ?? ''
  const artistScore = stringSimilarity(spotify.artist, ytArtistName)

  let durationBonus = 0
  if (spotify.durationMs && ytTrack.duration) {
    const ytDurationMs = ytTrack.duration * 1000
    const diffMs = Math.abs(spotify.durationMs - ytDurationMs)
    if (diffMs <= 3000) {
      durationBonus = 0.15
    } else if (diffMs <= 6000) {
      durationBonus = 0.08
    }
  }

  // Composite score: 55% title, 35% artist + duration bonus
  const totalScore = Math.min(1.0, titleScore * 0.55 + artistScore * 0.35 + durationBonus)

  return {
    isMatch: totalScore >= threshold,
    score: Math.round(totalScore * 100) / 100,
  }
}
