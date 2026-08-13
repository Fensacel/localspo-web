import { NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/spotifyAuth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const urlOrId = searchParams.get('url') || searchParams.get('id')

  if (!urlOrId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Spotify playlist URL or ID is required.' },
      },
      { status: 400 }
    )
  }

  // Extract playlist ID
  let playlistId = urlOrId.trim()
  const match = urlOrId.match(/playlist\/([a-zA-Z0-9]+)/)
  if (match) {
    playlistId = match[1]
  }

  try {
    const token = await getAppAccessToken()

    // 1. Fetch Playlist Header Metadata
    const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=id,name,description,images,tracks.total`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (!playlistRes.ok) {
      if (playlistRes.status === 404 || playlistRes.status === 403 || playlistRes.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'PLAYLIST_PRIVATE_OR_NOT_FOUND',
              message: 'Playlist ini privat, tidak bisa diimpor tanpa login pemiliknya (atau playlist tidak ditemukan).',
            },
          },
          { status: 404 }
        )
      }
      const errBody = await playlistRes.text()
      return NextResponse.json(
        {
          success: false,
          error: { code: 'SPOTIFY_API_ERROR', message: `Spotify API error: ${playlistRes.status} ${errBody}` },
        },
        { status: playlistRes.status }
      )
    }

    const playlistData = await playlistRes.json()

    // 2. Fetch Playlist Tracks (handle pagination if > 100 tracks)
    let currentUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(name,artists,album(name,images),duration_ms)),next`
    const rawTracks: any[] = []

    while (currentUrl) {
      const tracksRes: Response = await fetch(currentUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })

      if (!tracksRes.ok) break

      const pageData: any = await tracksRes.json()
      if (Array.isArray(pageData.items)) {
        rawTracks.push(...pageData.items)
      }
      currentUrl = pageData.next ?? null
    }

    // 3. Normalize Track List
    const tracks = rawTracks
      .filter((item) => item?.track && item.track.name)
      .map((item) => {
        const t = item.track
        const primaryArtist = t.artists?.[0]?.name ?? 'Unknown Artist'
        const coverUrl = t.album?.images?.[0]?.url

        return {
          title: t.name,
          artist: primaryArtist,
          artists: t.artists?.map((a: any) => a.name) ?? [primaryArtist],
          album: t.album?.name,
          durationMs: t.duration_ms,
          coverUrl,
        }
      })

    const coverUrl = playlistData.images?.[0]?.url

    return NextResponse.json({
      success: true,
      data: {
        playlist: {
          id: playlistData.id,
          name: playlistData.name,
          description: playlistData.description ?? '',
          coverUrl,
          images: playlistData.images ?? (coverUrl ? [{ url: coverUrl }] : []),
          trackCount: tracks.length,
        },
        tracks,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'IMPORT_ERROR', message: err?.message || 'Failed to fetch Spotify playlist metadata.' },
      },
      { status: 500 }
    )
  }
}
