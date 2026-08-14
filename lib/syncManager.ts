import { useFollowedPlaylistStore } from '@/store/useFollowedPlaylistStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { useLibraryStore } from '@/store/useLibraryStore'
import type { StreamSong } from '@/types/streamSong'

let syncIntervalTimer: ReturnType<typeof setInterval> | null = null

/**
 * Synchronizes a single followed Spotify playlist if Auto-Sync is enabled
 */
export async function syncFollowedPlaylist(spotifyId: string): Promise<{ newTracksCount: number }> {
  const store = useFollowedPlaylistStore.getState()
  const followedInfo = store.followedPlaylists[spotifyId]

  if (!followedInfo || !followedInfo.isFollowed || !followedInfo.autoSyncEnabled) {
    return { newTracksCount: 0 }
  }

  try {
    const res = await fetch(`/api/spotify/playlist?id=${encodeURIComponent(spotifyId)}`)
    const json = await res.json()

    if (!json.success || !json.data?.tracks) {
      console.warn(`[SyncManager] Failed to fetch Spotify playlist update for ${spotifyId}:`, json.error)
      return { newTracksCount: 0 }
    }

    const fetchedSongs: StreamSong[] = json.data.tracks || []
    const playlistState = usePlaylistStore.getState()

    // Find target local playlist by assigned ID or name
    const localPlaylist = playlistState.playlists.find(
      (p) => p.id === followedInfo.localPlaylistId || p.name.toLowerCase().trim() === followedInfo.name.toLowerCase().trim()
    )

    if (!localPlaylist) {
      // Local playlist was deleted — auto-unfollow to stop future sync attempts
      console.warn(`[SyncManager] Local playlist not found for ${spotifyId} — removing stale follow entry`)
      useFollowedPlaylistStore.getState().unfollowPlaylist(spotifyId)
      return { newTracksCount: 0 }
    }

    const existingSongIds = new Set(localPlaylist.songs.map((s) => s.id))
    const newSongs = fetchedSongs.filter((s) => !existingSongIds.has(s.id))

    if (newSongs.length > 0) {
      console.log(`[SyncManager] Found ${newSongs.length} new songs for playlist "${localPlaylist.name}"!`)

      // 1. Add new songs to global library
      useLibraryStore.getState().addSongs(newSongs)

      // 2. Append new songs to local playlist store
      const updatedSongs = [...localPlaylist.songs, ...newSongs]
      playlistState.addImportedPlaylist(
        localPlaylist.name,
        localPlaylist.coverUrl || json.data.playlist?.coverUrl || '',
        updatedSongs,
        localPlaylist.id
      )

      // 3. Sync new tracks to database if applicable
      try {
        await fetch(`/api/playlists/${localPlaylist.id}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: newSongs.map((song) => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              thumbnail: song.coverUrl,
              thumbnailUrl: song.coverUrl,
              duration: Math.round(song.durationMs / 1000),
            })),
          }),
        })
      } catch (dbErr) {
        console.warn('[SyncManager] DB track sync skipped:', dbErr)
      }
    }

    // Update last sync timestamp and total count
    store.updateLastSynced(spotifyId, fetchedSongs.length)
    return { newTracksCount: newSongs.length }
  } catch (err) {
    console.error(`[SyncManager] Error syncing ${spotifyId}:`, err)
    return { newTracksCount: 0 }
  }
}

/**
 * Synchronizes all followed Spotify playlists
 */
export async function syncAllFollowedPlaylists(): Promise<void> {
  const store = useFollowedPlaylistStore.getState()
  const followedList = Object.values(store.followedPlaylists).filter(
    (item) => item.isFollowed && item.autoSyncEnabled
  )

  if (followedList.length === 0) return

  console.log(`[SyncManager] Starting auto-sync for ${followedList.length} followed playlists...`)

  for (const item of followedList) {
    await syncFollowedPlaylist(item.spotifyId)
  }
}

/**
 * Initializes client-side background sync interval (default: 10 minutes)
 */
export function startBackgroundSync(intervalMs = 10 * 60 * 1000): void {
  if (syncIntervalTimer) return // Already running

  // Initial sync check shortly after start (5s delay)
  setTimeout(() => {
    syncAllFollowedPlaylists().catch(console.error)
  }, 5000)

  // Periodic interval check
  syncIntervalTimer = setInterval(() => {
    syncAllFollowedPlaylists().catch(console.error)
  }, intervalMs)
}
