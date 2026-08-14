import type { Lyrics } from '@/types/lyrics'
import { parseLRC } from './lrcParser'

/**
 * NetEase Cloud Music Lyrics Provider
 * Industry standard for highly accurate Asian, K-Pop, and Global synced lyrics.
 */
export async function fetchNetEaseLyrics(params: {
  artist: string
  track: string
}): Promise<Lyrics | null> {
  try {
    const query = `${params.artist} ${params.track}`.trim()
    const searchUrl = `https://music.163.com/api/cloudsearch/pc?s=${encodeURIComponent(query)}&type=1&offset=0&limit=5`

    const searchRes = await fetch(searchUrl, {
      headers: {
        Referer: 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 },
    })

    if (!searchRes.ok) return null
    const searchJson = await searchRes.json()
    const songs = searchJson.result?.songs || []
    if (!songs.length) return null

    const songId = songs[0]?.id
    if (!songId) return null

    const lyricUrl = `https://music.163.com/api/song/lyric?os=pc&id=${songId}&lv=-1&kv=-1&tv=-1`
    const lyricRes = await fetch(lyricUrl, {
      headers: {
        Referer: 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 },
    })

    if (!lyricRes.ok) return null
    const lyricJson = await lyricRes.json()
    const rawLrc = lyricJson.lrc?.lyric

    if (!rawLrc || typeof rawLrc !== 'string') return null

    const lines = parseLRC(rawLrc)
    if (lines.length === 0) return null

    return {
      synced: true,
      lines,
      plain: rawLrc.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim(),
    }
  } catch (err) {
    console.warn('[NetEase Lyrics] Error:', err)
    return null
  }
}
