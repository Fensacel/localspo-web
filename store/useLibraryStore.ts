import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StreamSong } from '@/types/streamSong'

interface LibraryState {
  allSongs: Record<string, StreamSong> // Global index of imported songs, key: song.id
  addSongs: (songs: StreamSong[]) => void
  updateResolvedVideoId: (songId: string, videoId: string) => void
  clearResolvedVideoId: (songId: string) => void
  clearAllResolvedVideoIds: () => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      allSongs: {},

      addSongs: (songs) => {
        set((state) => {
          const updated = { ...state.allSongs }
          for (const song of songs) {
            const existing = updated[song.id]
            updated[song.id] = {
              ...song,
              resolvedVideoId: existing?.resolvedVideoId || song.resolvedVideoId,
            }
          }
          return { allSongs: updated }
        })
      },

      updateResolvedVideoId: (songId, videoId) => {
        set((state) => {
          const existing = state.allSongs[songId]
          if (!existing) return state
          return {
            allSongs: {
              ...state.allSongs,
              [songId]: {
                ...existing,
                resolvedVideoId: videoId,
              },
            },
          }
        })
      },

      clearResolvedVideoId: (songId) => {
        set((state) => {
          const existing = state.allSongs[songId]
          if (!existing) return state
          const updated = { ...state.allSongs }
          delete updated[songId].resolvedVideoId
          return { allSongs: updated }
        })
      },

      clearAllResolvedVideoIds: () => {
        set((state) => {
          const updated = { ...state.allSongs }
          for (const key of Object.keys(updated)) {
            delete updated[key].resolvedVideoId
          }
          return { allSongs: updated }
        })
      },
    }),
    {
      name: 'library-storage',
    }
  )
)
