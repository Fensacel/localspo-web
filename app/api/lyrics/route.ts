import { NextRequest, NextResponse } from 'next/server'
import { fetchLyrics } from '@/lib/lyrics/lrclib'

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
    const lyrics = await fetchLyrics({ artist, track, album, duration })

    if (!lyrics) {
      return NextResponse.json(
        { success: false, error: { code: 'LYRICS_NOT_FOUND', message: 'Lyrics not found.' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: lyrics })
  } catch (err) {
    console.error('[/api/lyrics]', err)
    return NextResponse.json(
      { success: false, error: { code: 'LYRICS_ERROR', message: 'Failed to fetch lyrics.' } },
      { status: 500 }
    )
  }
}
