import { NextRequest, NextResponse } from 'next/server'
import { fetchLyrics as fetchLrclib } from '@/lib/lyrics/lrclib'
import { fetchNetEaseLyrics } from '@/lib/lyrics/netease'
import { fetchLyricsOvh } from '@/lib/lyrics/lyricsovh'
import type { Lyrics } from '@/types/lyrics'
import fs from 'fs'
import path from 'path'
import { parseLRC } from '@/lib/lyrics/lrcParser'
import { normalizeString } from '@/lib/matcher'

function getLocalLyrics(track: string, artist?: string): Lyrics | null {
  const normTrack = normalizeString(track)
  if (normTrack.includes('iconic heart')) {
    try {
      const lrcPath = path.join(process.cwd(), 'public', 'Hearts2Hearts - ICONIC HEART.lrc')
      if (fs.existsSync(lrcPath)) {
        const content = fs.readFileSync(lrcPath, 'utf-8')
        const lines = parseLRC(content)
        const plain = lines.map((l) => l.text).join('\n')
        return {
          id: 'local-hearts2hearts-iconic-heart',
          trackName: 'ICONIC HEART',
          artistName: 'Hearts2Hearts',
          synced: true,
          lines,
          plain,
        }
      }
    } catch (e) {
      console.warn('[getLocalLyrics] Error reading local LRC:', e)
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const artist = sp.get('artist')?.trim()
  const track = sp.get('track')?.trim()
  const album = sp.get('album')?.trim() || undefined
  const durationStr = sp.get('duration')
  const duration = durationStr ? parseFloat(durationStr) : undefined

  if (!artist || !track) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAMS', message: 'artist and track required.' } },
      { status: 400 }
    )
  }

  try {
    // 1. Check if local matched LRC exists
    const localResult = getLocalLyrics(track, artist)
    if (localResult) {
      return NextResponse.json({ success: true, data: localResult })
    }
    const [netEaseLyrics, lrclibLyrics] = await Promise.allSettled([
      fetchNetEaseLyrics({ artist, track }),
      fetchLrclib({ artist, track, album, duration }),
    ])

    const netEaseResult: Lyrics | null =
      netEaseLyrics.status === 'fulfilled' ? netEaseLyrics.value : null
    const lrclibResult: Lyrics | null =
      lrclibLyrics.status === 'fulfilled' ? lrclibLyrics.value : null

    // Choose best synced lyrics
    // If NetEase has granular synced lines (e.g. phrase-by-phrase for K-Pop / Asian / Pop), prioritize it
    let chosen: Lyrics | null = null

    if (netEaseResult?.synced && netEaseResult.lines.length > 0) {
      if (lrclibResult?.synced && lrclibResult.lines.length > 0) {
        // Compare granularity: NetEase usually splits into individual phrases like Spotify Musixmatch
        if (netEaseResult.lines.length >= lrclibResult.lines.length) {
          chosen = netEaseResult
        } else {
          chosen = lrclibResult
        }
      } else {
        chosen = netEaseResult
      }
    } else if (lrclibResult?.synced && lrclibResult.lines.length > 0) {
      chosen = lrclibResult
    } else if (lrclibResult?.plain) {
      chosen = lrclibResult
    } else if (netEaseResult?.plain) {
      chosen = netEaseResult
    } else {
      // Fallback to Lyrics.ovh for plain text
      chosen = await fetchLyricsOvh({ artist, track })
    }

    if (!chosen) {
      return NextResponse.json(
        { success: false, error: { code: 'LYRICS_NOT_FOUND', message: 'Lyrics not found.' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: chosen })
  } catch (err) {
    console.error('[/api/lyrics]', err)
    return NextResponse.json(
      { success: false, error: { code: 'LYRICS_ERROR', message: 'Failed to fetch lyrics.' } },
      { status: 500 }
    )
  }
}
