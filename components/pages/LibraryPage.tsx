'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { useRouter } from 'next/navigation'
import { PlaylistCard } from '@/components/music/PlaylistCard'
import { Plus, Download } from 'lucide-react'
import { useState } from 'react'
import { ImportPlaylistModal } from '@/components/playlist/ImportPlaylistModal'
import { usePlayerStore } from '@/store/playerStore'

export function LibraryPage() {
  const { user } = useAuthStore()
  const { playlists: localPlaylists, removePlaylist } = usePlaylistStore()
  const { currentTrack, isPlaying, contextTitle } = usePlayerStore()
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const { data: serverPlaylists, isLoading, refetch } = useQuery({
    queryKey: ['playlists'],
    queryFn: async () => {
      const res = await fetch('/api/playlists')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })

  async function handleCreate() {
    if (!newTitle.trim()) return
    await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
    setNewTitle('')
    setCreating(false)
    refetch()
  }

  async function handleDeletePlaylist(pl: { id: string; title: string; isLocal: boolean }) {
    if (!confirm(`Yakin ingin menghapus playlist "${pl.title}"?`)) return

    if (pl.isLocal) {
      removePlaylist(pl.id)
    }

    // Also attempt server delete if id exists or user is logged in
    try {
      await fetch(`/api/playlists/${pl.id}`, { method: 'DELETE' })
      refetch()
    } catch {
      // Ignore if local-only
    }
  }

  // Combine local imported playlists and server playlists with strict deduplication
  const combinedPlaylists = [
    ...localPlaylists.map((pl) => ({
      id: pl.id,
      title: pl.name,
      coverUrl: pl.coverUrl,
      trackCount: pl.songs.length,
      isLocal: true,
    })),
    ...(serverPlaylists ?? [])
      .filter(
        (spl: any) =>
          !localPlaylists.some(
            (lpl) =>
              lpl.id === spl.id ||
              lpl.name.toLowerCase().trim() === spl.title?.toLowerCase().trim()
          )
      )
      .map((spl: any) => {
        const count = Array.isArray(spl.playlist_tracks)
          ? spl.playlist_tracks[0]?.count ?? spl.playlist_tracks.length
          : spl.tracks?.length ?? 0
        return {
          id: spl.id,
          title: spl.title,
          coverUrl: spl.cover_url || spl.coverUrl,
          trackCount: count,
          isLocal: false,
        }
      }),
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Your Library</h1>
            <p className="text-xs text-gray-400">Playlists, imported collections, and saved music</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-full text-sm font-semibold transition-all shadow-sm"
            >
              <Download size={16} /> Import Playlist
            </button>
            {user && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-sm font-medium transition-colors"
              >
                <Plus size={16} /> New Playlist
              </button>
            )}
          </div>
        </div>

        <ImportPlaylistModal
          isOpen={importing}
          onClose={() => setImporting(false)}
          onSuccess={refetch}
        />

        {creating && (
          <div className="mb-6 flex gap-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Playlist name…"
              className="flex-1 bg-white/10 rounded-lg px-4 py-2 text-sm outline-none border border-white/20 focus:border-blue-500"
            />
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">
              Create
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        )}

        {isLoading && combinedPlaylists.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse py-12">
            Loading library…
          </div>
        ) : combinedPlaylists.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-gray-400">Belum ada playlist. Import playlist kamu sekarang!</p>
            <button
              onClick={() => setImporting(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xs transition-all shadow-lg shadow-blue-600/20"
            >
              <Download size={16} /> Import Playlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {combinedPlaylists.map((pl) => {
              const isPlayingThis =
                isPlaying &&
                (contextTitle === pl.title ||
                  (pl.isLocal &&
                    localPlaylists
                      .find((l) => l.id === pl.id)
                      ?.songs.some((s) => s.id === currentTrack?.id)))

              return (
                <PlaylistCard
                  key={pl.id}
                  title={pl.title}
                  subtitle={`${pl.trackCount} songs`}
                  imageUrl={pl.coverUrl}
                  isPlaying={isPlayingThis}
                  onClick={() => router.push(`/playlist/${pl.id}`)}
                  onDelete={() => handleDeletePlaylist(pl)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
