'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { useLikedTracks } from '@/lib/hooks/useLikedTracks'
import { useRouter } from 'next/navigation'
import { PlaylistCard } from '@/components/music/PlaylistCard'
import { Plus, Download, Heart, ArrowUpDown, Search, Music, FolderPlus } from 'lucide-react'
import { useState } from 'react'
import { ImportPlaylistModal } from '@/components/playlist/ImportPlaylistModal'
import { usePlayerStore } from '@/store/playerStore'
import { useToastStore } from '@/store/toastStore'

export function LibraryPage() {
  const { user, profile } = useAuthStore()
  const { playlists: localPlaylists } = usePlaylistStore()
  const { likedTracks } = useLikedTracks()
  const { currentTrack, isPlaying, contextTitle } = usePlayerStore()
  const { showToast } = useToastStore()
  const router = useRouter()

  const [activeFilter, setActiveFilter] = useState<'all' | 'playlists' | 'liked'>('playlists')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const creatorName =
    profile?.displayName ??
    user?.user_metadata?.full_name ??
    user?.email?.split('@')[0] ??
    'User'
  const creatorAvatar = profile?.avatarUrl ?? user?.user_metadata?.avatar_url

  const { data: serverPlaylists, isLoading, refetch } = useQuery({
    queryKey: ['playlists', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/playlists')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })

  async function handleCreate() {
    if (!newTitle.trim()) return
    const name = newTitle.trim()

    // Add to usePlaylistStore with user.id
    const newId = crypto.randomUUID()
    usePlaylistStore.setState((state) => ({
      playlists: [
        {
          id: newId,
          name,
          songs: [],
          createdAt: Date.now(),
          userId: user?.id,
        },
        ...state.playlists,
      ],
    }))

    // Save to Supabase Cloud Database if logged in
    if (user) {
      try {
        await fetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: name }),
        })
        refetch()
      } catch (e) {
        console.error('Failed to sync new playlist to Supabase:', e)
      }
    }

    setNewTitle('')
    setCreating(false)
    showToast(`Playlist "${name}" berhasil dibuat!`, 'success')
  }

  // Filter local playlists for the current user
  const userScopedLocalPlaylists = localPlaylists.filter((pl) => {
    if (user) return pl.userId === user.id || !pl.userId
    return !pl.userId
  })

  // Combine local imported playlists and server playlists with strict deduplication
  const combinedPlaylists = [
    ...userScopedLocalPlaylists.map((pl) => ({
      id: pl.id,
      title: pl.name,
      coverUrl: pl.coverUrl,
      trackCount: pl.songs?.length || 0,
      isLocal: true,
    })),
    ...(serverPlaylists ?? [])
      .filter(
        (spl: any) =>
          !userScopedLocalPlaylists.some(
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
    <div className="flex-1 overflow-y-auto pb-28 selection:bg-white/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        {/* Top Header Row (Spotify Style) */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-sky-400 border border-white/20 flex items-center justify-center shrink-0 shadow-md">
              {creatorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creatorAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">
                  {(creatorName.charAt(0) || 'U').toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Your Library</h1>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => router.push('/search')}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Cari"
            >
              <Search size={22} />
            </button>

            {/* Plus / Add Menu */}
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Tambah playlist"
            >
              <Plus size={24} />
            </button>

            {/* Add Dropdown Menu */}
            {showAddMenu && (
              <div
                className="absolute right-0 top-12 w-52 bg-[#181818]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setShowAddMenu(false)}
              >
                <button
                  onClick={() => setImporting(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 transition-colors text-left"
                >
                  <Download size={16} className="text-[#38bdf8]" />
                  <span>Import dari Spotify</span>
                </button>

                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 transition-colors text-left"
                >
                  <FolderPlus size={16} className="text-white" />
                  <span>Buat Playlist Baru</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Category Pills */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveFilter('playlists')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'playlists'
                ? 'bg-white text-black'
                : 'bg-white/10 text-gray-300 hover:text-white border border-white/5'
            }`}
          >
            Playlists
          </button>

          <button
            onClick={() => setActiveFilter('liked')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              activeFilter === 'liked'
                ? 'bg-white text-black'
                : 'bg-white/10 text-gray-300 hover:text-white border border-white/5'
            }`}
          >
            Liked Songs
          </button>
        </div>

        {/* Create Playlist Input Banner */}
        {creating && (
          <div className="mb-5 p-4 rounded-2xl bg-[#181818] border border-white/15 flex flex-col sm:flex-row gap-2.5 animate-in fade-in slide-in-from-top-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Nama playlist baru..."
              className="flex-1 bg-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none border border-white/10 focus:border-[#38bdf8]"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleCreate}
                className="px-5 py-2 bg-[#38bdf8] hover:bg-[#38bdf8]/90 text-black font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                Buat
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 font-semibold rounded-xl text-xs transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Modal Import Spotify */}
        <ImportPlaylistModal
          isOpen={importing}
          onClose={() => setImporting(false)}
          onSuccess={refetch}
        />

        {/* Library Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {/* 1. Liked Songs Card */}
          {activeFilter !== 'playlists' && (
            <div
              onClick={() => router.push('/liked')}
              className="group cursor-pointer select-none"
            >
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-500 mb-2.5 flex items-center justify-center shadow-lg group-hover:scale-[1.02] transition-transform">
                <Heart size={36} fill="white" className="text-white" />
              </div>
              <p className="text-sm font-bold text-white truncate leading-tight">Liked Songs</p>
              <p className="text-xs text-gray-400 truncate mt-1">Playlist • {likedTracks.length} lagu</p>
            </div>
          )}

          {/* 2. User & Imported Playlists */}
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
                subtitle={`Playlist • ${pl.trackCount} lagu`}
                imageUrl={pl.coverUrl}
                isPlaying={isPlayingThis}
                onClick={() => router.push(`/playlist/${pl.id}`)}
              />
            )
          })}
        </div>

        {/* Empty state */}
        {combinedPlaylists.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-500">
              <Music size={28} />
            </div>
            <div>
              <p className="text-base font-bold text-white">Library masih kosong</p>
              <p className="text-xs text-gray-400 mt-1">Import playlist Spotify favoritmu sekarang</p>
            </div>
            <button
              onClick={() => setImporting(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#38bdf8] hover:bg-[#38bdf8]/90 text-black rounded-full font-bold text-xs transition-all shadow-lg active:scale-95"
            >
              <Download size={15} /> Import Playlist
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
