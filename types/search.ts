import type { Track } from './track'
import type { Album } from './album'
import type { Artist } from './artist'
import type { Playlist } from './playlist'

export type SearchResultType = 'song' | 'album' | 'artist' | 'playlist'

export type SearchResult =
  | { type: 'song'; data: Track }
  | { type: 'album'; data: Album }
  | { type: 'artist'; data: Artist }
  | { type: 'playlist'; data: Playlist }

export interface SearchResponse {
  songs: Track[]
  albums: Album[]
  artists: Artist[]
  playlists: Playlist[]
  topResult?: SearchResult
}
