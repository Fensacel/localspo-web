import type { Track } from './track'

export interface Playlist {
  id: string
  ownerId?: string

  title: string
  description?: string

  coverUrl?: string
  thumbnail?: string

  type: 'local' | 'imported' | 'cloud' | 'followed' | 'spotify'

  tracks: Track[]

  createdAt?: string
  updatedAt?: string
  importedAt?: string

  source?: 'spotify' | 'localspo' | 'ytmusic'
  sourcePlaylistId?: string

  trackCount?: number
  duration?: number
}
