import { NextRequest, NextResponse } from 'next/server'
import { fetchLyrics as fetchLrclib } from '@/lib/lyrics/lrclib'
import { fetchNetEaseLyrics } from '@/lib/lyrics/netease'
import { fetchLyricsOvh } from '@/lib/lyrics/lyricsovh'
import type { Lyrics } from '@/types/lyrics'

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
    // Query providers in parallel (NetEase Cloud Music & LRCLIB)
    const [netEaseLyrics, lrclibLyrics] = await Promise.allSettled([
      fetchNetEaseLyrics({ artist, track }),
      fetchLrclib({ artist, track, album, duration }),
    ])

    const netEaseResult: Lyrics | null =
      netEaseLyrics.status === 'fulfilled' ? netEaseLyrics.value : null
    const lrclibResult: Lyrics | null =
      lrclibLyrics.status === 'fulfilled' ? lrclibLyrics.value : null

    // Prioritize LRCLIB first for original song lyrics
    // (NetEase cloudsearch can return wrong song matches for query terms like "ILLIT It's Me")
    let chosen: Lyrics | null = null

    if (lrclibResult?.synced && lrclibResult.lines.length > 0) {
      chosen = lrclibResult
    } else if (netEaseResult?.synced && netEaseResult.lines.length > 0) {
      chosen = netEaseResult
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
