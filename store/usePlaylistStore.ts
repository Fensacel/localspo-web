import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StreamSong } from '@/types/streamSong'

export interface ImportedPlaylist {
  id: string
  name: string
  coverUrl: string
  songs: StreamSong[]
  importedAt: string
}

interface PlaylistState {
  playlists: ImportedPlaylist[]
  addImportedPlaylist: (name: string, coverUrl: string, songs: StreamSong[], customId?: string) => void
  removePlaylist: (id: string) => void
  updateSongResolvedVideoId: (songId: string, videoId: string) => void
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set) => ({
      playlists: [],

      addImportedPlaylist: (name, coverUrl, songs, customId) => {
        const id = customId || `pl-${Date.now()}`
        const newPlaylist: ImportedPlaylist = {
          id,
          name,
          coverUrl,
          songs,
          importedAt: new Date().toISOString(),
        }

        set((state) => ({
          playlists: [newPlaylist, ...state.playlists.filter((p) => p.id !== id)],
        }))
      },

      removePlaylist: (id) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
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
    }),
    {
      name: 'playlist-storage',
    }
  )
)
