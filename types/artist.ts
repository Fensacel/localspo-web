import type { Album } from './album'
import type { Track } from './track'

export interface Artist {
  id: string
  name: string
  thumbnail?: string
  thumbnailUrl?: string
  description?: string
  subscribers?: string
  albums?: Album[]
  singles?: Album[]
  topSongs?: Track[]
  relatedArtists?: { id: string; name: string; thumbnail?: string }[]
  source: 'ytmusic'
}
