'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'
import { PlaylistCard } from '@/components/music/PlaylistCard'
import { Plus, Download } from 'lucide-react'
import { useState } from 'react'
import { ImportPlaylistModal } from '@/components/playlist/ImportPlaylistModal'

export function LibraryPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const { data: playlists, isLoading, refetch } = useQuery({
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

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Sign in to see your library.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
        Loading library…
      </div>
    )
  }

  const list = playlists ?? []

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your Library</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-full text-sm font-semibold transition-all shadow-sm"
            >
              <Download size={16} /> Import Spotify Playlist
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-sm font-medium transition-colors"
            >
              <Plus size={16} /> New Playlist
            </button>
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

        {list.length === 0 ? (
          <p className="text-gray-400">No playlists yet. Create one!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {list.map((pl: { id: string; title: string; coverUrl?: string; tracks?: unknown[] }) => (
              <PlaylistCard
                key={pl.id}
                title={pl.title}
                subtitle={`${pl.tracks?.length ?? 0} songs`}
                imageUrl={pl.coverUrl}
                onClick={() => router.push(`/playlist/${pl.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
