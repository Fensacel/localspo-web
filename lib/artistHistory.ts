export interface ArtistHistoryItem {
  name: string
  count: number
  lastPlayedAt: number
}

const STORAGE_KEY = 'localspo_artist_history'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

export function getRawArtistHistory(): Record<string, ArtistHistoryItem> {
  if (!isBrowser()) return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (err) {
    console.error('Failed to parse artist history:', err)
    return {}
  }
}

export function recordArtist(artistName: string): void {
  if (!isBrowser() || !artistName || artistName.toLowerCase() === 'unknown artist') return

  try {
    const history = getRawArtistHistory()
    const key = artistName.trim().toLowerCase()
    const existing = history[key]

    history[key] = {
      name: artistName.trim(),
      count: (existing?.count || 0) + 1,
      lastPlayedAt: Date.now(),
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch (err) {
    console.error('Failed to record artist history:', err)
  }
}

export function recordMultipleArtists(artistNames: string[]): void {
  if (!isBrowser() || !Array.isArray(artistNames)) return

  try {
    const history = getRawArtistHistory()

    for (const rawName of artistNames) {
      if (!rawName || rawName.toLowerCase() === 'unknown artist') continue
      const name = rawName.trim()
      const key = name.toLowerCase()
      const existing = history[key]

      history[key] = {
        name,
        count: (existing?.count || 0) + 1,
        lastPlayedAt: Date.now(),
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch (err) {
    console.error('Failed to record multiple artists:', err)
  }
}

export function getTopArtists(limit = 8): string[] {
  const history = getRawArtistHistory()
  const items = Object.values(history)

  if (items.length === 0) return []

  // Sort by play count descending, then by lastPlayedAt descending
  items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.lastPlayedAt - a.lastPlayedAt
  })

  return items.slice(0, limit).map((item) => item.name)
}
