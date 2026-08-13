import type { StreamSong } from '@/types/streamSong'

export interface ExtractedPlaylist {
  playlist: {
    id: string
    name: string
    description?: string
    coverUrl: string
    trackCount: number
  }
  songs: StreamSong[]
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function mapToStreamSong(track: any, index: number, defaultCoverUrl: string): StreamSong {
  let id = track.id || ''
  if (track.uri && track.uri.includes(':track:')) {
    id = track.uri.split(':track:')[1]
  } else if (track.uri) {
    const parts = track.uri.split(':')
    id = parts[parts.length - 1]
  }
  if (!id) {
    id = track.uid || `sp-${index}-${Date.now()}`
  }

  const title = track.title || track.name || 'Unknown Track'
  let artist = 'Unknown Artist'
  if (track.subtitle) {
    artist = track.subtitle
  } else if (Array.isArray(track.artists) && track.artists.length > 0) {
    artist = track.artists.map((a: any) => (typeof a === 'string' ? a : a.name)).filter(Boolean).join(', ')
  } else if (typeof track.artist === 'string') {
    artist = track.artist
  }

  const album = track.album?.name || track.albumName || undefined
  const durationMs = Number(track.duration || track.durationMs || track.duration_ms || 0)

  const coverUrl =
    track.coverArt?.sources?.[0]?.url ||
    track.album?.images?.[0]?.url ||
    track.image ||
    defaultCoverUrl ||
    ''

  return {
    id,
    title,
    artist,
    album,
    durationMs,
    coverUrl,
    source: 'spotify-import',
  }
}

/**
 * Enriches songs with individual track album artwork via public Spotify oEmbed API in parallel batches
 */
async function enrichTrackCovers(songs: StreamSong[]): Promise<StreamSong[]> {
  const chunkSize = 15
  const enriched = songs.map((s) => ({ ...s }))

  for (let i = 0; i < enriched.length; i += chunkSize) {
    const chunk = enriched.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (song, idx) => {
        const actualIndex = i + idx
        if (!song.id || song.id.startsWith('sp-')) return

        try {
          const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${song.id}`)
          if (res.ok) {
            const json = await res.json()
            if (json.thumbnail_url) {
              enriched[actualIndex].coverUrl = json.thumbnail_url
            }
          }
        } catch {
          // Keep existing coverUrl if oembed request fails
        }
      })
    )
  }

  return enriched
}

/**
 * Primary extractor: Scrapes metadata directly from Spotify embed HTML (__NEXT_DATA__)
 */
export async function extractSpotifyPlaylist(playlistId: string): Promise<ExtractedPlaylist> {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`EMBED_FETCH_FAILED_${res.status}`)
  }

  const html = await res.text()

  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/)
  if (!match) {
    throw new Error('NEXT_DATA_NOT_FOUND')
  }

  const data = JSON.parse(match[1])

  // If status inside pageProps is 404 or entity is missing
  if (data?.props?.pageProps?.status === 404) {
    throw new Error('SPOTIFY_PLAYLIST_NOT_FOUND_OR_PRIVATE')
  }

  const entity = data?.props?.pageProps?.state?.data?.entity
  const trackList: any[] = entity?.trackList || entity?.tracks || data?.props?.pageProps?.state?.data?.tracks || []

  if (!entity && trackList.length === 0) {
    throw new Error('SPOTIFY_ENTITY_EMPTY')
  }

  const name = entity?.name || entity?.title || 'Imported Spotify Playlist'
  const description = entity?.description || entity?.subtitle || ''
  const coverUrl =
    entity?.coverArt?.sources?.[0]?.url ||
    entity?.visualIdentity?.image?.[entity?.visualIdentity?.image?.length - 1]?.url ||
    entity?.images?.[0]?.url ||
    ''

  const initialSongs = trackList.map((track, i) => mapToStreamSong(track, i, coverUrl))
  const songs = await enrichTrackCovers(initialSongs)

  return {
    playlist: {
      id: playlistId,
      name,
      description,
      coverUrl,
      trackCount: songs.length,
    },
    songs,
  }
}

/**
 * Fallback 1: Scrapes from embed generator variant URL
 */
export async function extractFromRegularPage(playlistId: string): Promise<ExtractedPlaylist> {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`FALLBACK_FETCH_FAILED_${res.status}`)
  }

  const html = await res.text()

  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/)
  if (!match) {
    throw new Error('FALLBACK_NEXT_DATA_NOT_FOUND')
  }

  const data = JSON.parse(match[1])
  if (data?.props?.pageProps?.status === 404) {
    throw new Error('FALLBACK_PLAYLIST_NOT_FOUND')
  }

  const entity = data?.props?.pageProps?.state?.data?.entity
  const trackList: any[] = entity?.trackList || entity?.tracks || data?.props?.pageProps?.state?.data?.tracks || []

  const name = entity?.name || entity?.title || 'Imported Spotify Playlist'
  const description = entity?.description || ''
  const coverUrl =
    entity?.coverArt?.sources?.[0]?.url ||
    entity?.visualIdentity?.image?.[0]?.url ||
    ''

  const initialSongs = trackList.map((track, i) => mapToStreamSong(track, i, coverUrl))
  const songs = await enrichTrackCovers(initialSongs)

  if (songs.length === 0) {
    throw new Error('FALLBACK_NO_TRACKS')
  }

  return {
    playlist: {
      id: playlistId,
      name,
      description,
      coverUrl,
      trackCount: songs.length,
    },
    songs,
  }
}

/**
 * Robust extractor wrapper with fallback layering
 */
export async function extractSpotifyPlaylistWithFallback(playlistId: string): Promise<ExtractedPlaylist> {
  try {
    return await extractSpotifyPlaylist(playlistId)
  } catch (e) {
    console.error('[spotifyExtractor] primary method failed:', e)
    try {
      return await extractFromRegularPage(playlistId)
    } catch (e2) {
      console.error('[spotifyExtractor] fallback method failed:', e2)
      throw new Error('SPOTIFY_EXTRACT_FAILED')
    }
  }
}
