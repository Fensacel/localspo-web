import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StreamSong } from '@/types/streamSong'

export interface ImportedPlaylist {
  id: string
  name: string
  coverUrl?: string
  songs: StreamSong[]
  importedAt?: string
  createdAt?: number
  userId?: string
}

interface PlaylistState {
  playlists: ImportedPlaylist[]
  addImportedPlaylist: (
    name: string,
    coverUrl: string,
    songs: StreamSong[],
    customId?: string,
    userId?: string
  ) => void
  addSongToPlaylist: (playlistId: string, song: StreamSong) => void
  removeSongFromPlaylist: (playlistId: string, songId: string) => void
  removePlaylist: (id: string) => void
  updatePlaylist: (id: string, updates: { name?: string; coverUrl?: string }) => void
  updateSongResolvedVideoId: (songId: string, videoId: string) => void
  clearPlaylists: () => void
  setPlaylists: (playlists: ImportedPlaylist[]) => void
}

/**
 * Normalise a raw playlist entry that may come from the desktop app format
 * (which stores songIds: string[] instead of songs: StreamSong[]).
 * For desktop-format playlists we have no song metadata available locally,
 * so we create minimal stub StreamSong objects so the array is non-empty
 * and the playlist is visible. Song details will be fetched/resolved on play.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalisePlaylist(raw: any): ImportedPlaylist {
  // Resolve cover URL (desktop may store a local file path under coverPath)
  const coverUrl: string | undefined =
    raw.coverUrl ||
    (typeof raw.coverPath === 'string' && raw.coverPath.startsWith('http')
      ? raw.coverPath
      : undefined)

  // If songs array is already present and non-empty, use it as-is.
  if (Array.isArray(raw.songs) && raw.songs.length > 0) {
    return {
      id: raw.id,
      name: raw.name,
      coverUrl,
      songs: raw.songs as StreamSong[],
      importedAt: raw.importedAt,
      createdAt: raw.createdAt,
      userId: raw.userId,
    }
  }

  // Desktop format: convert songIds to minimal StreamSong stubs.
  const songIds: string[] = Array.isArray(raw.songIds) ? raw.songIds : []
  const songs: StreamSong[] = songIds.map((sid) => ({
    id: sid,
    title: sid, // placeholder — will be replaced once resolved
    artist: '',
    album: '',
    coverUrl: '',
    durationMs: 0,
    source: 'spotify-import' as const,
    resolvedVideoId: undefined,
  }))

  return {
    id: raw.id,
    name: raw.name,
    coverUrl,
    songs,
    importedAt: raw.importedAt,
    createdAt: raw.createdAt,
    userId: raw.userId,
  }
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set) => ({
      playlists: [],

      addImportedPlaylist: (name, coverUrl, songs, customId, userId) => {
        const id = customId || `pl-${Date.now()}`
        const newPlaylist: ImportedPlaylist = {
          id,
          name,
          coverUrl,
          songs,
          importedAt: new Date().toISOString(),
          userId,
        }

        set((state) => ({
          playlists: [newPlaylist, ...state.playlists.filter((p) => p.id !== id)],
        }))
      },

      addSongToPlaylist: (playlistId, song) => {
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id !== playlistId) return pl
            const alreadyExists = pl.songs.some(
              (s) =>
                s.id === song.id ||
                s.title?.toLowerCase().trim() === song.title?.toLowerCase().trim()
            )
            if (alreadyExists) return pl
            return {
              ...pl,
              songs: [...pl.songs, song],
            }
          }),
        }))
      },

      removeSongFromPlaylist: (playlistId, songId) => {
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id !== playlistId) return pl
            return {
              ...pl,
              songs: pl.songs.filter((s) => s.id !== songId),
            }
          }),
        }))
      },

      removePlaylist: (id) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
        }))
      },

      updatePlaylist: (id, updates) => {
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id !== id) return pl
            return {
              ...pl,
              name: updates.name !== undefined ? updates.name : pl.name,
              coverUrl: updates.coverUrl !== undefined ? updates.coverUrl : pl.coverUrl,
            }
          }),
        }))
      },

      updateSongResolvedVideoId: (songId, videoId) => {
        set((state) => ({
          playlists: state.playlists.map((pl) => ({
            ...pl,
            songs: pl.songs.map((s) =>
              s.id === songId ? { ...s, resolvedVideoId: videoId } : s
            ),
          })),
        }))
      },

      clearPlaylists: () => set({ playlists: [] }),
      setPlaylists: (playlists) => set({ playlists }),
    }),
    {
      name: 'localspo-user-playlists',
      storage: createJSONStorage(() => localStorage),
      // Migrate persisted data from desktop-app format (songIds) to web format (songs)
      migrate: (persistedState, version) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = persistedState as any
        if (Array.isArray(state?.playlists)) {
          state.playlists = state.playlists.map(normalisePlaylist)
        }
        return state
      },
      version: 2,
    }
  )
)
