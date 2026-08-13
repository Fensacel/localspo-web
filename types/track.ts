export interface TrackArtist {
  id?: string
  name: string
}

export interface TrackAlbum {
  id?: string
  name: string
}

export interface Track {
  id: string
  videoId?: string

  title: string

  artist: TrackArtist
  artists?: TrackArtist[]

  album?: TrackAlbum
  albumArtist?: string

  duration?: number

  thumbnail?: string
  thumbnailUrl?: string

  streamUrl?: string

  source: 'ytmusic' | 'spotify' | 'local'

  explicit?: boolean
  year?: number
}
