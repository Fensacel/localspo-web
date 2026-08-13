'use client'

import { useState } from 'react'
import { Disc, Download, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

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

  if (!isOpen) return null

  function extractPlaylistId(input: string): string {
    const trimmed = input.trim()
    if (trimmed.includes('spotify.com/playlist/')) {
      const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/)
      if (match) return match[1]
    }
    return trimmed
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
      // 1. Fetch Spotify playlist metadata
      const res = await fetch(`/api/spotify/playlist?id=${encodeURIComponent(playlistId)}`)
      const json = await res.json()

      if (!json.success || !json.data) {
        throw new Error(json.error?.message || 'Gagal mengambil playlist dari Spotify.')
      }

      const playlistInfo = json.data.playlist || json.data
      const rawTracks = json.data.tracks || []

      if (!rawTracks || rawTracks.length === 0) {
        throw new Error('Playlist ini kosong atau tidak memiliki lagu yang dapat diimpor.')
      }

      setStatusText(`Mencocokkan ${rawTracks.length} lagu dengan YT Music...`)

      // 2. Match tracks with YT Music
      const matchRes = await fetch('/api/spotify/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: rawTracks }),
      })
      const matchJson = await matchRes.json()

      if (!matchJson.success) {
        throw new Error(matchJson.error?.message || 'Gagal mencocokkan lagu Spotify.')
      }

      const matchedTracks = matchJson.data || (matchJson.results ? matchJson.results.map((r: any) => r.matchedTrack).filter(Boolean) : [])

      setStatusText('Menyimpan playlist ke LocalSpo...')

      // 3. Create LocalSpo playlist
      const createRes = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: playlistInfo.name || playlistInfo.title || 'Imported Spotify Playlist',
          description: playlistInfo.description || `Imported from Spotify playlist ${playlistId}`,
          type: 'spotify',
          source: 'spotify',
          sourcePlaylistId: playlistId,
          coverUrl: playlistInfo.coverUrl || playlistInfo.images?.[0]?.url,
        }),
      })
      const createJson = await createRes.json()

      if (!createJson.success || !createJson.data) {
        throw new Error(createJson.error?.message || 'Gagal membuat playlist LocalSpo.')
      }

      const newPlaylistId = createJson.data.id

      // 4. Add matched tracks to playlist in batch
      if (matchedTracks.length > 0) {
        setStatusText(`Menambahkan ${matchedTracks.length} lagu ke playlist...`)
        const trackRes = await fetch(`/api/playlists/${newPlaylistId}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tracks: matchedTracks }),
        })
        const trackJson = await trackRes.json()
        if (!trackJson.success) {
          console.warn('[ImportPlaylistModal] Partial warning adding tracks:', trackJson.error)
        }
      }

      setStatusText('Selesai!')
      onSuccess?.()
      onClose()
      router.push(`/playlist/${newPlaylistId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengimpor.'
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
          <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
            <Download size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Import Playlist Spotify</h3>
            <p className="text-xs text-gray-400">Masukkan URL atau ID playlist Spotify publik</p>
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
              placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWAOFi2xC6"
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-all"
            />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-green-400 animate-pulse bg-green-500/10 p-3 rounded-xl">
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
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-green-500 hover:bg-green-400 text-black rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-green-500/20"
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
