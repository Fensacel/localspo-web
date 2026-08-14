import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
    }
  )
)
