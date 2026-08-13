import type { Track } from './track'

export interface Album {
  id: string
  browseId?: string
  title: string
  artist: {
    id?: string
    name: string
  }
  year?: number
  thumbnail?: string
  thumbnailUrl?: string
  trackCount?: number
  duration?: number
  tracks?: Track[]
  source: 'ytmusic'
}
