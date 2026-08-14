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

export const KNOWN_TRACK_OVERRIDES: Record<string, string> = {
  'iconic heart': 'A9EpZWrQ3dM',
  'iconic heart hearts2hearts': 'A9EpZWrQ3dM',
  'heart emoji hearts2hearts': 'A9EpZWrQ3dM',
  'heart emoji': 'A9EpZWrQ3dM',
  'iconic heart heart emoji': 'A9EpZWrQ3dM',
}

export function getKnownTrackOverride(title: string, artist?: string): string | null {
  if (!title) return null
  const normTitle = normalizeString(title)
  const normArtist = artist ? normalizeString(artist) : ''
  const combined = `${normTitle} ${normArtist}`.trim()

  if (KNOWN_TRACK_OVERRIDES[combined]) return KNOWN_TRACK_OVERRIDES[combined]
  if (KNOWN_TRACK_OVERRIDES[normTitle]) return KNOWN_TRACK_OVERRIDES[normTitle]
  return null
}

const LANGUAGE_VERSION_KEYWORDS = [
  'japanese',
  'japan',
  'jpn',
  'korean',
  'kor',
  'chinese',
  'mandarin',
  'english',
  'eng',
  'spanish',
]

const VERSION_KEYWORDS = [
  'remix',
  'live',
  'concert',
  'acoustic',
  'instrumental',
  'inst',
  'karaoke',
  'cover',
  'speed up',
  'sped up',
  'slowed',
  'reverb',
  'nightcore',
  'demo',
  '8d',
  'edit',
  '10 minute',
  'ten minute',
  'extended',
  'orchestral',
  'taylor\'s version',
  ...LANGUAGE_VERSION_KEYWORDS,
]

/**
 * Normalizes title/artist string by removing common video/audio noise while PRESERVING version identifiers (Japanese, 10 Minute, Remix, etc.)
 */
export function normalizeString(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    // Remove non-version tags like (Official Music Video), [Official Audio], (MV), [HD]
    .replace(/[\(\[\{]\s*(?:official\s+)?(?:music\s+)?(?:video|audio|mv|visualizer|lyric\s+video|lyrics|hd|4k|remastered?|deluxe)\s*[\)\]\}]/gi, '')
    // Remove feat/ft tags like (feat. Artist)
    .replace(/[\(\[\{]\s*(?:feat|ft|featuring)\.?\s+[^\)\]\}]+[\)\]\}]/gi, '')
    .replace(/\b(?:feat|ft|featuring)\.?\s+[^\s]+/gi, '')
    // Unicode punctuation removal
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculates Dice Coefficient string similarity (0.0 to 1.0)
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeString(a)
  const normB = normalizeString(b)

  if (normA === normB && normA.length > 0) return 1.0
  if (!normA || !normB) return 0.0

  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length)
    const maxLen = Math.max(normA.length, normB.length)
    return Math.max(0.75, minLen / maxLen)
  }

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
  threshold = 0.45
): { isMatch: boolean; score: number } {
  const normTargetTitle = normalizeString(spotify.title)
  const normYtTitle = normalizeString(ytTrack.title)

  const titleScore = stringSimilarity(spotify.title, ytTrack.title)
  const titleIncludes =
    (normTargetTitle.length >= 3 && normYtTitle.includes(normTargetTitle)) ||
    (normYtTitle.length >= 3 && normTargetTitle.includes(normYtTitle))
  const effectiveTitleScore = titleIncludes ? Math.max(titleScore, 0.85) : titleScore

  // CRITICAL RULE: If title similarity is below 0.30 and not a substring match, NEVER match
  // (Prevents matching completely different songs by the same artist e.g. "Flutter" for "Iconic Heart")
  if (effectiveTitleScore < 0.30 && !titleIncludes) {
    return { isMatch: false, score: 0 }
  }

  const ytArtistName = typeof ytTrack.artist === 'string' ? ytTrack.artist : ytTrack.artist?.name ?? ''
  const artistScore = stringSimilarity(spotify.artist, ytArtistName)

  let durationBonus = 0
  let durationPenalty = 0
  if (spotify.durationMs && ytTrack.duration) {
    const ytDurationMs = ytTrack.duration * 1000
    const diffMs = Math.abs(spotify.durationMs - ytDurationMs)
    if (diffMs <= 3000) {
      durationBonus = 0.15
    } else if (diffMs <= 6000) {
      durationBonus = 0.08
    } else if (diffMs > 25000) {
      durationPenalty = 0.50 // Heavy penalty if length differs by >25s
    } else if (diffMs > 12000) {
      durationPenalty = 0.30
    }
  }

  // Version mismatch penalty (e.g. candidate is Japanese/Remix/Live when Spotify track is not, or vice-versa)
  const spotifyTitleLower = spotify.title.toLowerCase()
  const ytTitleLower = ytTrack.title.toLowerCase()
  let versionPenalty = 0
  let versionBonus = 0

  for (const kw of VERSION_KEYWORDS) {
    const targetHas = spotifyTitleLower.includes(kw)
    const ytHas = ytTitleLower.includes(kw)

    if (targetHas && ytHas) {
      versionBonus += 0.25 // Both have version keyword
    } else if (targetHas && !ytHas) {
      versionPenalty += 0.55 // Target wanted version (e.g. Japanese Ver. / 10 Minute), but candidate is standard
    } else if (!targetHas && ytHas) {
      versionPenalty += 0.45 // Target is standard, candidate is version/remix/live
    }
  }

  // Bonus for exact normalized title match
  let exactTitleBonus = 0
  if (normTargetTitle === normYtTitle && normTargetTitle.length > 0) {
    exactTitleBonus = 0.25
  }

  // Composite score calculation with high title weighting
  const rawScore =
    effectiveTitleScore * 0.60 +
    artistScore * 0.25 +
    durationBonus +
    exactTitleBonus +
    versionBonus -
    versionPenalty -
    durationPenalty

  const totalScore = Math.max(0, Math.min(1.0, rawScore))

  return {
    isMatch: totalScore >= threshold,
    score: Math.round(totalScore * 100) / 100,
  }
}
