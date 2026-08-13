'use client'

import { useState } from 'react'
import { Disc, Download, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { useLibraryStore } from '@/store/useLibraryStore'
import { useFollowedPlaylistStore } from '@/store/useFollowedPlaylistStore'
import type { StreamSong } from '@/types/streamSong'

interface ImportPlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ImportPlaylistModal({ isOpen, onClose, onSuccess }: ImportPlaylistModalProps) {
  const [urlOrId, setUrlOrId] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const { addImportedPlaylist } = usePlaylistStore()
  const { addSongs } = useLibraryStore()
  const { followPlaylist } = useFollowedPlaylistStore()

  if (!isOpen) return null

  function extractPlaylistId(input: string): string {
    const trimmed = input.trim()
    if (trimmed.includes('spotify.com/playlist/')) {
      const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/)
      if (match) return match[1]
    }
    return trimmed.split('?')[0].split('&')[0]
  }

  async function handleImport() {
    const playlistId = extractPlaylistId(urlOrId)
    if (!playlistId) {
      setError('Masukkan ID atau URL playlist Spotify yang valid.')
      return
    }

    setLoading(true)
    setError(null)
    setStatusText('Mengambil metadata playlist Spotify...')

    try {
      // 1. Fetch Spotify playlist metadata via server-side scraper endpoint
      const res = await fetch(`/api/spotify/playlist?id=${encodeURIComponent(playlistId)}`)
      const json = await res.json()

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || 'Gagal mengambil data playlist, coba lagi nanti atau pastikan link benar')
      }

      const playlistInfo = json.data.playlist
      const songs: StreamSong[] = json.data.tracks || []

      if (!songs || songs.length === 0) {
        throw new Error('Playlist ini kosong atau tidak memiliki lagu yang dapat diimpor.')
      }

      setStatusText(`Menyimpan ${songs.length} lagu...`)

      // 2. Add songs globally to useLibraryStore
      addSongs(songs)

      let assignedId = playlistId

      // 3. Try creating playlist in database and adding tracks if logged in
      try {
        const createRes = await fetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: playlistInfo.name || 'Imported Playlist',
            description: playlistInfo.description || `Imported playlist ${playlistId}`,
            type: 'spotify',
            source: 'spotify',
            sourcePlaylistId: playlistId,
            coverUrl: playlistInfo.coverUrl,
          }),
        })
        const createJson = await createRes.json()

        if (createJson.success && createJson.data?.id) {
          const dbPlaylistId = createJson.data.id
          assignedId = dbPlaylistId

          // Sync tracks to database
          await fetch(`/api/playlists/${dbPlaylistId}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tracks: songs.map((song) => ({
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
        }
      } catch (dbErr) {
        console.warn('[ImportPlaylistModal] Database sync skipped or user guest:', dbErr)
      }

      // 4. Add playlist to usePlaylistStore with matching assigned ID
      addImportedPlaylist(
        playlistInfo.name || 'Imported Playlist',
        playlistInfo.coverUrl || '',
        songs,
        assignedId
      )

      // 5. Register Auto-Follow & Live Sync in useFollowedPlaylistStore
      followPlaylist(
        playlistId,
        assignedId,
        playlistInfo.name || 'Imported Playlist',
        playlistInfo.coverUrl || '',
        songs.length
      )

      setStatusText('Selesai!')
      onSuccess?.()
      onClose()
      setUrlOrId('')
      router.push('/library')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengambil data playlist, coba lagi nanti atau pastikan link benar'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Download size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Import Playlist</h3>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Spotify Playlist Link / ID
            </label>
            <input
              type="text"
              value={urlOrId}
              onChange={(e) => setUrlOrId(e.target.value)}
              placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-blue-400 animate-pulse bg-blue-500/10 p-3 rounded-xl">
              <Loader2 size={16} className="animate-spin" />
              <span>{statusText}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleImport}
              disabled={loading || !urlOrId.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Mengimpor...
                </>
              ) : (
                <>
                  <Disc size={14} />
                  Import Playlist
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
