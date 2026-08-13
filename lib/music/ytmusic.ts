/**
 * YouTube Music metadata layer.
 * Uses ytmusicapi via a child process or HTTP to yt-music-server.
 * Falls back to YouTube Data API v3 for metadata only.
 *
 * Architecture:
 *   Next.js API routes → ytmusic.ts → ytmusicapi (Python) via exec
 *   or → yt-music-compatible Node library
 *
 * For the MVP we use yt-search + custom normalization as a fallback
 * since ytmusicapi is Python and requires additional setup.
 */

import { normalizeTrack, normalizeAlbum, normalizeArtist } from './normalizeTrack'
import type { Track } from '@/types/track'
import type { Album } from '@/types/album'
import type { Artist } from '@/types/artist'
import type { SearchResponse } from '@/types/search'

const isDev = process.env.NODE_ENV === 'development'

function log(...args: unknown[]) {
  if (isDev) console.log('[YTMusic]', ...args)
}

// Try to import ytmusicapi node bindings if available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ytmusicClient: any = null

async function getClient() {
  if (ytmusicClient) return ytmusicClient
  try {
    // Try ytmusic-api (npm package)
    const YTMusic = await import('ytmusic-api').catch(() => null)
    if (YTMusic) {
      const client = new YTMusic.default()
      await client.initialize()
      ytmusicClient = client
      log('ytmusic-api client initialized')
      return client
    }
  } catch {
    log('ytmusic-api not available, using fallback')
  }
  return null
}

export async function searchYTMusic(query: string): Promise<SearchResponse> {
  log('search:', query)
  const client = await getClient()

  const response: SearchResponse = {
    songs: [],
    albums: [],
    artists: [],
    playlists: [],
  }

  if (client) {
    try {
      const [songs, albums, artists] = await Promise.allSettled([
        client.searchSongs(query),
        client.searchAlbums(query),
        client.searchArtists(query),
      ])

      if (songs.status === 'fulfilled' && Array.isArray(songs.value)) {
        response.songs = songs.value.slice(0, 20).map(normalizeTrack)
      }
      if (albums.status === 'fulfilled' && Array.isArray(albums.value)) {
        response.albums = albums.value.slice(0, 10).map(normalizeAlbum)
      }
      if (artists.status === 'fulfilled' && Array.isArray(artists.value)) {
        response.artists = artists.value.slice(0, 10).map(normalizeArtist)
      }

      if (response.songs.length > 0) {
        response.topResult = { type: 'song', data: response.songs[0] }
      }
      return response
    } catch (err) {
      log('ytmusic-api search error:', err)
    }
  }

  // Fallback: yt-search
  return await searchFallback(query)
}

async function searchFallback(query: string): Promise<SearchResponse> {
  // ytsr removed — incompatible with Turbopack (uses require() with absolute paths).
  // ytmusic-api is the primary source; if unavailable return empty.
  log('searchFallback: no secondary source, returning empty results for:', query)
  return {
    songs: [],
    albums: [],
    artists: [],
    playlists: [],
  }
}

function parseDurationString(dur: string): number {
  const parts = dur.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

export async function getAlbum(browseId: string): Promise<Album | null> {
  log('getAlbum:', browseId)
  const client = await getClient()

  if (client) {
    try {
      const album = await client.getAlbum(browseId)
      if (album) return normalizeAlbum(album)
    } catch (err) {
      log('getAlbum error:', err)
    }
  }

  return null
}

export async function getArtist(browseId: string): Promise<Artist | null> {
  log('getArtist:', browseId)
  const client = await getClient()

  if (client) {
    try {
      const artist = await client.getArtist(browseId)
      if (artist) {
        const base = normalizeArtist(artist)
        const rawAlbums = artist.topAlbums ?? artist.albums ?? []
        const rawSingles = artist.topSingles ?? artist.singles ?? []
        const rawSongs = artist.topSongs ?? artist.songs ?? []

        return {
          ...base,
          albums: Array.isArray(rawAlbums) ? rawAlbums.map(normalizeAlbum) : [],
          singles: Array.isArray(rawSingles) ? rawSingles.map(normalizeAlbum) : [],
          topSongs: Array.isArray(rawSongs)
            ? rawSongs.filter((s: any) => s.type === 'SONG' || s.videoId).map(normalizeTrack)
            : [],
        }
      }
    } catch (err) {
      log('getArtist error:', err)
    }
  }

  return null
}

export async function getSong(videoId: string): Promise<Track | null> {
  log('getSong:', videoId)
  const client = await getClient()

  if (client) {
    try {
      const song = await client.getSong(videoId)
      if (song) return normalizeTrack(song)
    } catch (err) {
      log('getSong error:', err)
    }
  }

  return null
}
