import type { LyricLine } from '@/types/lyrics'

const TIMESTAMP_RE = /\[(\d{2}):(\d{2})\.?(\d{0,3})\]/g

/**
 * Parse LRC format into sorted LyricLine array.
 * Supports:
 *   [mm:ss.xx]text
 *   [mm:ss.xxx]text
 *   [mm:ss]text
 *   [mm:ss.xx][mm:ss.xx]text  (multiple timestamps)
 */
export function parseLRC(lrc: string): LyricLine[] {
  if (!lrc || typeof lrc !== 'string') return []

  const lines: LyricLine[] = []

  for (const rawLine of lrc.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    // Collect all timestamps in this line
    const timestamps: number[] = []
    let match: RegExpExecArray | null
    let lastIndex = 0

    TIMESTAMP_RE.lastIndex = 0
    while ((match = TIMESTAMP_RE.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const ms = match[3]
        ? parseInt(match[3].padEnd(3, '0'), 10)
        : 0

      const time = minutes * 60 + seconds + ms / 1000
      timestamps.push(time)
      lastIndex = TIMESTAMP_RE.lastIndex
    }

    if (timestamps.length === 0) continue

    // Text is everything after the last timestamp tag
    const text = line.slice(lastIndex).trim()
    // Skip metadata lines like [ar:Artist] [ti:Title]
    if (!text || /^[a-z]{2}:/.test(text.toLowerCase())) continue

    for (const time of timestamps) {
      lines.push({ time, text })
    }
  }

  // Sort by time ascending, filter invalid
  return lines
    .filter((l) => isFinite(l.time) && l.time >= 0)
    .sort((a, b) => a.time - b.time)
}

/**
 * Binary search for the active lyric line at currentTime.
 * Returns the index of the latest line where line.time <= currentTime.
 * Returns -1 if before the first line.
 */
export function findActiveLyricIndex(
  lines: LyricLine[],
  currentTime: number
): number {
  if (!lines.length) return -1

  let lo = 0
  let hi = lines.length - 1
  let result = -1

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (lines[mid].time <= currentTime) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return result
}
