import type { Lyrics } from '@/types/lyrics'

/**
 * Lyrics.ovh Fallback Provider (Plain Lyrics)
 */
export async function fetchLyricsOvh(params: {
  artist: string
  track: string
}): Promise<Lyrics | null> {
  try {
    const artist = encodeURIComponent(params.artist.trim())
    const track = encodeURIComponent(params.track.trim())
    const url = `https://api.lyrics.ovh/v1/${artist}/${track}`

    const res = await fetch(url, {
      next: { revalidate: 86400 },
    })

    if (!res.ok) return null
    const json = await res.json()
    if (!json.lyrics) return null

    return {
      synced: false,
      lines: [],
      plain: json.lyrics.trim(),
    }
  } catch {
    return null
  }
}
