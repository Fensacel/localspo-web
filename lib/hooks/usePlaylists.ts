'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { Track } from '@/types/track'
import { Playlist } from '@/types/playlist'

export function usePlaylists() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: playlists = [], isLoading } = useQuery<Playlist[]>({
    queryKey: ['playlists'],
    queryFn: async () => {
      if (!user) return []
      const res = await fetch('/api/playlists')
      const json = await res.json()
      if (!json.success || !Array.isArray(json.data)) return []
      return json.data.map((item: any) => ({
        id: item.id,
        ownerId: item.owner_id,
        title: item.title,
        description: item.description,
        coverUrl: item.cover_url,
        type: item.type || 'cloud',
        tracks: [],
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }))
    },
    enabled: !!user,
  })

  const createPlaylistMutation = useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      if (!user) throw new Error('Must be logged in')
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed to create playlist')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
  })

  const addTrackToPlaylistMutation = useMutation({
    mutationFn: async ({ playlistId, track }: { playlistId: string; track: Track }) => {
      if (!user) throw new Error('Must be logged in')
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Failed to add track to playlist')
      return json.data
    },
    onSuccess: (_, { playlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
  })

  return {
    playlists,
    isLoading,
    createPlaylist: (title: string, description?: string) =>
      createPlaylistMutation.mutateAsync({ title, description }),
    addTrackToPlaylist: (playlistId: string, track: Track) =>
      addTrackToPlaylistMutation.mutateAsync({ playlistId, track }),
  }
}
