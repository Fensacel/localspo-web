import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface FollowedPlaylistInfo {
  spotifyId: string
  localPlaylistId: string
  name: string
  coverUrl: string
  isFollowed: boolean
  autoSyncEnabled: boolean
  lastSyncedAt: string
  lastTrackCount: number
}

interface FollowedPlaylistState {
  followedPlaylists: Record<string, FollowedPlaylistInfo> // Key: spotifyId
  followPlaylist: (
    spotifyId: string,
    localPlaylistId: string,
    name: string,
    coverUrl: string,
    trackCount: number
  ) => void
  unfollowPlaylist: (spotifyId: string) => void
  toggleAutoSync: (spotifyId: string) => void
  updateLastSynced: (spotifyId: string, trackCount: number) => void
}

export const useFollowedPlaylistStore = create<FollowedPlaylistState>()(
  persist(
    (set) => ({
      followedPlaylists: {},

      followPlaylist: (spotifyId, localPlaylistId, name, coverUrl, trackCount) => {
        set((state) => ({
          followedPlaylists: {
            ...state.followedPlaylists,
            [spotifyId]: {
              spotifyId,
              localPlaylistId,
              name,
              coverUrl,
              isFollowed: true,
              autoSyncEnabled: true,
              lastSyncedAt: new Date().toISOString(),
              lastTrackCount: trackCount,
            },
          },
        }))
      },

      unfollowPlaylist: (spotifyId) => {
        set((state) => {
          const updated = { ...state.followedPlaylists }
          if (updated[spotifyId]) {
            updated[spotifyId] = {
              ...updated[spotifyId],
              isFollowed: false,
              autoSyncEnabled: false,
            }
          }
          return { followedPlaylists: updated }
        })
      },

      toggleAutoSync: (spotifyId) => {
        set((state) => {
          const existing = state.followedPlaylists[spotifyId]
          if (!existing) return state
          return {
            followedPlaylists: {
              ...state.followedPlaylists,
              [spotifyId]: {
                ...existing,
                autoSyncEnabled: !existing.autoSyncEnabled,
              },
            },
          }
        })
      },

      updateLastSynced: (spotifyId, trackCount) => {
        set((state) => {
          const existing = state.followedPlaylists[spotifyId]
          if (!existing) return state
          return {
            followedPlaylists: {
              ...state.followedPlaylists,
              [spotifyId]: {
                ...existing,
                lastSyncedAt: new Date().toISOString(),
                lastTrackCount: trackCount,
              },
            },
          }
        })
      },
    }),
    {
      name: 'followed-playlist-storage',
    }
  )
)
