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
    track.albumOfTrack?.coverArt?.sources?.[0]?.url ||
    track.album?.images?.[0]?.url ||
    track.album?.coverArt?.sources?.[0]?.url ||
    track.image ||
    track.thumbnail ||
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
 * Fetches all track URIs from Spotify spclient API using anonymous token from embed page
 */
async function fetchFullTracklistFromSpclient(playlistId: string, accessToken: string): Promise<string[]> {
  const res = await fetch(
    `https://spclient.wg.spotify.com/playlist/v2/playlist/${playlistId}?limit=500`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    throw new Error(`SPCLIENT_FETCH_FAILED_${res.status}`)
  }

  const json = await res.json()
  const items: any[] = json?.contents?.items || []
  return items.map((item) => item.uri).filter(Boolean)
}

/**
 * Decorates track URIs into detailed metadata via Spotify partner pathfinder API in batches
 */
async function fetchTracksMetadataFromPartner(uris: string[], accessToken: string): Promise<any[]> {
  const chunkSize = 100
  const allEntities: any[] = []

  for (let i = 0; i < uris.length; i += chunkSize) {
    const chunk = uris.slice(i, i + chunkSize)
    try {
      const res = await fetch('https://api-partner.spotify.com/pathfinder/v1/query', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          variables: { uris: chunk },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: 'f952da037440f694cc6925b9e3f649d39077a744c4db7dfba01cb883723f4f77',
            },
          },
        }),
        cache: 'no-store',
      })

      if (res.ok) {
        const json = await res.json()
        const entities = json?.data?.lookupEntities || []
        allEntities.push(...entities)
      }
    } catch (e) {
      console.warn('[spotifyExtractor] partner query chunk failed:', e)
    }
  }

  return allEntities
}

/**
 * Maps pathfinder GraphQL lookup entity to StreamSong format
 */
function mapPartnerEntityToStreamSong(entity: any, index: number, defaultCoverUrl: string): StreamSong {
  const track = entity?.typedEntity?.data || {}
  const uri = entity?.uri || track?.uri || ''
  let id = track.id || ''
  if (!id && uri.includes(':track:')) {
    id = uri.split(':track:')[1]
  } else if (!id && uri) {
    const parts = uri.split(':')
    id = parts[parts.length - 1]
  }
  if (!id) {
    id = `sp-${index}-${Date.now()}`
  }

  const title = track.name || entity?.identityTrait?.name || 'Unknown Track'
  
  const artistItems = track.artists?.items || []
  let artist = 'Unknown Artist'
  if (artistItems.length > 0) {
    artist = artistItems.map((a: any) => a?.profile?.name).filter(Boolean).join(', ')
  }

  const album = track.albumOfTrack?.name || undefined
  const durationMs = Number(
    track.duration?.totalMilliseconds ||
      (entity?.consumptionExperienceTrait?.duration?.seconds ? entity.consumptionExperienceTrait.duration.seconds * 1000 : 0)
  )

  const coverSources = track.albumOfTrack?.coverArt?.sources || []
  const coverUrl = coverSources[0]?.url || defaultCoverUrl || ''

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

  const accessToken: string | undefined = data?.props?.pageProps?.state?.settings?.session?.accessToken

  let songs: StreamSong[] = []

  if (accessToken) {
    try {
      const fullUris = await fetchFullTracklistFromSpclient(playlistId, accessToken)
      if (fullUris.length > 0) {
        const entities = await fetchTracksMetadataFromPartner(fullUris, accessToken)
        if (entities.length > 0) {
          songs = entities.map((entity, i) => mapPartnerEntityToStreamSong(entity, i, coverUrl))
        }
      }
    } catch (spClientErr) {
      console.warn('[spotifyExtractor] full tracklist fetch failed, using embed tracks:', spClientErr)
    }
  }

  if (songs.length === 0) {
    const initialSongs = trackList.map((track, i) => mapToStreamSong(track, i, coverUrl))
    songs = await enrichTrackCovers(initialSongs)
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

  const accessToken: string | undefined = data?.props?.pageProps?.state?.settings?.session?.accessToken

  let songs: StreamSong[] = []

  if (accessToken) {
    try {
      const fullUris = await fetchFullTracklistFromSpclient(playlistId, accessToken)
      if (fullUris.length > 0) {
        const entities = await fetchTracksMetadataFromPartner(fullUris, accessToken)
        if (entities.length > 0) {
          songs = entities.map((entity, i) => mapPartnerEntityToStreamSong(entity, i, coverUrl))
        }
      }
    } catch (spClientErr) {
      console.warn('[spotifyExtractor] fallback full tracklist fetch failed:', spClientErr)
    }
  }

  if (songs.length === 0) {
    const initialSongs = trackList.map((track, i) => mapToStreamSong(track, i, coverUrl))
    songs = await enrichTrackCovers(initialSongs)
  }

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
