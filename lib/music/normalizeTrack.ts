import type { Track } from '@/types/track'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeTrack(raw: any): Track {
  // videoId
  const videoId: string =
    raw.videoId ?? raw.video_id ?? raw.id ?? ''

  // title — must come from the track itself
  const title: string =
    raw.title ?? raw.name ?? 'Unknown Title'

  // artist
  const artistName: string =
    raw.artist?.name ??
    (typeof raw.artist === 'string' ? raw.artist : undefined) ??
    raw.artists?.[0]?.name ??
    raw.artistName ??
    raw.author ??
    'Unknown Artist'

  const artistId: string | undefined =
    raw.artist?.artistId ?? raw.artist?.id ?? raw.artists?.[0]?.artistId ?? raw.artists?.[0]?.id ?? undefined

  // multiple artists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artists = Array.isArray(raw.artists)
    ? raw.artists.map((a: any) => ({ id: a.artistId ?? a.id, name: a.name }))
    : undefined

  // album
  const albumName: string | undefined =
    raw.album?.name ?? raw.albumName ?? undefined
  const albumId: string | undefined =
    raw.album?.albumId ?? raw.album?.id ?? raw.albumId ?? undefined

  // duration in seconds
  const duration: number | undefined =
    typeof raw.duration === 'number'
      ? raw.duration
      : typeof raw.duration_seconds === 'number'
        ? raw.duration_seconds
        : typeof raw.lengthSeconds === 'number'
          ? raw.lengthSeconds
          : undefined

  // thumbnail
  const thumbnail: string | undefined =
    raw.thumbnail ??
    raw.thumbnailUrl ??
    raw.thumbnail_url ??
    (Array.isArray(raw.thumbnails)
      ? raw.thumbnails[raw.thumbnails.length - 1]?.url
      : undefined) ??
    undefined

  return {
    id: videoId || `track-${Math.random().toString(36).slice(2)}`,
    videoId: videoId || undefined,
    title,
    artist: { id: artistId, name: artistName },
    artists,
    album: albumName ? { id: albumId, name: albumName } : undefined,
    albumArtist: raw.albumArtist ?? raw.album_artist ?? undefined,
    duration,
    thumbnail,
    thumbnailUrl: thumbnail,
    source: 'ytmusic',
    explicit: raw.isExplicit ?? raw.explicit ?? false,
    year: raw.year ?? raw.releaseYear ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeAlbum(raw: any) {
  // ytmusic-api uses albumId; others use browseId or id
  const albumId: string = raw.albumId ?? raw.browseId ?? raw.id ?? ''
  const title: string = raw.title ?? raw.name ?? 'Unknown Album'
  const artistName: string =
    raw.artist?.name ?? raw.artists?.[0]?.name ?? raw.artistName ?? (typeof raw.artist === 'string' ? raw.artist : 'Unknown Artist')
  const artistId: string | undefined =
    raw.artist?.artistId ?? raw.artist?.id ?? raw.artists?.[0]?.artistId ?? raw.artists?.[0]?.id ?? undefined
  const thumbnail: string | undefined =
    raw.thumbnail ??
    raw.thumbnailUrl ??
    (Array.isArray(raw.thumbnails)
      ? raw.thumbnails[raw.thumbnails.length - 1]?.url
      : undefined) ??
    undefined

  const rawTracks = raw.tracks ?? raw.songs ?? []

  const tracks = Array.isArray(rawTracks) && rawTracks.length > 0
    ? rawTracks.map((t: any) => normalizeTrack({
        ...t,
        album: t.album ?? { albumId, name: title }
      }))
    : undefined

  return {
    id: albumId,
    browseId: albumId,
    title,
    artist: {
      id: artistId,
      name: artistName,
    },
    year: raw.year ?? raw.releaseYear ?? undefined,
    thumbnail,
    thumbnailUrl: thumbnail,
    trackCount: raw.trackCount ?? raw.track_count ?? (tracks?.length ?? 0),
    duration: raw.duration ?? undefined,
    tracks,
    source: 'ytmusic' as const,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeArtist(raw: any) {
  const thumbnail: string | undefined =
    raw.thumbnail ??
    raw.thumbnailUrl ??
    (Array.isArray(raw.thumbnails)
      ? raw.thumbnails[raw.thumbnails.length - 1]?.url
      : undefined) ??
    undefined

  return {
    // ytmusic-api uses artistId; others use browseId or id
    id: raw.artistId ?? raw.browseId ?? raw.id ?? '',
    name: raw.artist ?? raw.name ?? 'Unknown Artist',
    thumbnail,
    thumbnailUrl: thumbnail,
    description: raw.description ?? undefined,
    subscribers: raw.subscribers ?? undefined,
    source: 'ytmusic' as const,
  }
}
