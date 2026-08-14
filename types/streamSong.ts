export interface StreamSong {
  id: string              // Spotify track ID as internal identifier
  title: string
  artist: string
  album?: string
  durationMs: number
  coverUrl: string
  source: 'spotify-import'
  videoId?: string        // YouTube video ID if resolved
  resolvedVideoId?: string // Lazy resolved video ID on first playback
}
