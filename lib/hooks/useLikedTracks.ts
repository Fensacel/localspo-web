'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { Track } from '@/types/track'

export function useLikedTracks() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: likedTracks = [] } = useQuery<Track[]>({
    queryKey: ['liked'],
    queryFn: async () => {
      if (!user) return []
      const res = await fetch('/api/liked')
      const json = await res.json()
      if (!json.success || !Array.isArray(json.data)) return []
      return json.data.map((item: any) => {
        if (item.metadata_json) return item.metadata_json as Track
        if (item.title && item.artist) return item as Track
        return {
          id: item.track_id || item.id,
          videoId: item.video_id || item.videoId,
          title: item.title,
          artist: typeof item.artist === 'string' ? { name: item.artist } : item.artist || { name: 'Unknown' },
          album: typeof item.album === 'string' ? { name: item.album } : item.album,
          thumbnail: item.thumbnail_url || item.thumbnail,
          thumbnailUrl: item.thumbnail_url || item.thumbnailUrl,
          duration: item.duration,
          source: 'ytmusic',
        }
      })
    },
    enabled: !!user,
  })

  const likedSet = new Set(likedTracks.map((t) => t.id))
  const videoIdSet = new Set(likedTracks.map((t) => t.videoId).filter(Boolean) as string[])

  const toggleMutation = useMutation({
    mutationFn: async (track: Track) => {
      if (!user) {
        alert('Please sign in with Google to save liked songs.')
        return
      }
      const isCurrentlyLiked = likedSet.has(track.id) || (track.videoId ? videoIdSet.has(track.videoId) : false)
      if (isCurrentlyLiked) {
        const res = await fetch(`/api/liked/${encodeURIComponent(track.id)}`, {
          method: 'DELETE',
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error?.message || 'Failed to unlike track')
      } else {
        const res = await fetch('/api/liked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error?.message || 'Failed to like track')
      }
    },
    onMutate: async (track: Track) => {
      await queryClient.cancelQueries({ queryKey: ['liked'] })
      const previousLiked = queryClient.getQueryData<Track[]>(['liked']) || []
      const isCurrentlyLiked = previousLiked.some((t) => t.id === track.id || (t.videoId && t.videoId === track.videoId))
      const nextLiked = isCurrentlyLiked
        ? previousLiked.filter((t) => t.id !== track.id && (!track.videoId || t.videoId !== track.videoId))
        : [...previousLiked, track]
      queryClient.setQueryData(['liked'], nextLiked)
      return { previousLiked }
    },
    onError: (err, track, context) => {
      if (context?.previousLiked) {
        queryClient.setQueryData(['liked'], context.previousLiked)
      }
      console.error('[useLikedTracks] toggle like failed:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['liked'] })
    },
  })

  return {
    likedTracks,
    isLiked: (trackId?: string) => {
      if (!trackId) return false
      return likedSet.has(trackId) || videoIdSet.has(trackId)
    },
    toggleLike: (track: Track) => toggleMutation.mutate(track),
    isLoading: toggleMutation.isPending,
  }
}
