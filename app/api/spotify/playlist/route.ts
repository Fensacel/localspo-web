import { NextResponse } from 'next/server'
import { extractSpotifyPlaylistWithFallback } from '@/lib/spotifyExtractor'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const urlOrId = searchParams.get('url') || searchParams.get('id')

  if (!urlOrId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Gagal mengambil data playlist, coba lagi nanti atau pastikan link benar',
        },
      },
      { status: 400 }
    )
  }

  // Extract playlist ID from URL or raw ID input
  let playlistId = urlOrId.trim()
  const match = urlOrId.match(/playlist\/([a-zA-Z0-9]+)/)
  if (match) {
    playlistId = match[1]
  }

  // Strip query parameters if present
  playlistId = playlistId.split('?')[0].split('&')[0]

  try {
    const result = await extractSpotifyPlaylistWithFallback(playlistId)

    return NextResponse.json({
      success: true,
      data: {
        playlist: result.playlist,
        tracks: result.songs,
      },
    })
  } catch (err: any) {
    console.error('[SpotifyPlaylistRoute] Extract error:', err?.message || err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SPOTIFY_EXTRACT_FAILED',
          message: 'Gagal mengambil data playlist, coba lagi nanti atau pastikan link benar',
        },
      },
      { status: 500 }
    )
  }
}
