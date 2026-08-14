'use client'

import { useAuthStore } from '@/store/authStore'
import { usePlayerStore } from '@/store/playerStore'
import { usePlaylistStore } from '@/store/usePlaylistStore'
import { useLikedTracks } from '@/lib/hooks/useLikedTracks'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Clock,
  Heart,
  Music,
  ListMusic,
  BarChart2,
  LogOut,
  Camera,
  Edit2,
  Check,
  X,
  Play,
  Shuffle,
} from 'lucide-react'
import { useToastStore } from '@/store/toastStore'

export function ProfilePage() {
  const { user, profile, setProfile } = useAuthStore()
  const { queue } = usePlayerStore()
  const { playlists } = usePlaylistStore()
  const { likedTracks } = useLikedTracks()
  const { showToast } = useToastStore()
  const router = useRouter()

  const [avatarError, setAvatarError] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Listening stats from history
  const [streak, setStreak] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [avgTime, setAvgTime] = useState(0)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('localspo_history')
      if (!raw) return
      const entries: Array<{ played_at?: string; duration?: number }> = JSON.parse(raw)

      // Total + avg listening time
      const total = entries.reduce((s, e) => s + (e.duration || 0), 0)
      const avg = entries.length > 0 ? Math.round(total / entries.length) : 0
      setTotalTime(total)
      setAvgTime(avg)

      // Streak calculation
      const dates = new Set(entries.map((e) => e.played_at ? new Date(e.played_at).toDateString() : null).filter(Boolean))
      let s = 0
      const cur = new Date()
      if (!dates.has(cur.toDateString())) cur.setDate(cur.getDate() - 1)
      while (dates.has(cur.toDateString())) { s++; cur.setDate(cur.getDate() - 1) }
      setStreak(s)
    } catch {}
  }, [])

  function fmtTime(sec: number) {
    if (sec < 60) return `${Math.round(sec)}s`
    if (sec < 3600) return `${Math.floor(sec / 60)}m`
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${h}h ${m}m`
  }

  const avatarUrl = profile?.avatarUrl ?? user?.user_metadata?.avatar_url
  const displayName = profile?.displayName ?? user?.user_metadata?.full_name ?? user?.email ?? 'User'
  const initial = (displayName.charAt(0) || 'U').toUpperCase()
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })
    : null

  async function handleSaveName() {
    if (!nameValue.trim() || !user) return
    setSavingName(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: nameValue.trim() })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      // Update store with new name
      if (profile) {
        setProfile({ ...profile, displayName: nameValue.trim() })
      }
      showToast('Nama berhasil diperbarui!', 'success')
      setEditingName(false)
    } catch {
      showToast('Gagal memperbarui nama', 'error')
    } finally {
      setSavingName(false)
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar', 'error')
      return
    }
    setUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'banner')

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')

      if (profile) setProfile({ ...profile, bannerUrl: json.url })
      showToast('Banner berhasil diperbarui!', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[Banner Upload]', msg)
      showToast(`Gagal: ${msg}`, 'error')
    } finally {
      setUploadingBanner(false)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar', 'error')
      return
    }
    setUploadingAvatar(true)
    setAvatarError(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'avatar')

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')

      if (profile) setProfile({ ...profile, avatarUrl: json.url })
      showToast('Foto profil berhasil diperbarui!', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[Avatar Upload]', msg)
      showToast(`Gagal: ${msg}`, 'error')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-5 text-gray-400 p-8">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-4xl">
          👤
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">Belum masuk</p>
          <p className="text-sm text-gray-400 mt-1">Masuk untuk melihat profil kamu</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2.5 rounded-full bg-white text-black font-bold text-sm"
        >
          Kembali ke Home
        </button>
      </div>
    )
  }

  const stats = [
    { icon: Heart, label: 'Disukai', value: likedTracks.length, color: 'text-red-400', onClick: () => router.push('/liked') },
    { icon: ListMusic, label: 'Playlist', value: playlists.length, color: 'text-[#38bdf8]', onClick: () => router.push('/library') },
    { icon: Music, label: 'Di Antrean', value: queue.length, color: 'text-purple-400', onClick: () => router.push('/queue') },
  ]

  return (
    <div className="flex-1 overflow-y-auto pb-28">
      {/* Hero Banner */}
      <div
        className="relative h-48 sm:h-56 bg-gradient-to-br from-[#0070f3] via-purple-700 to-pink-700 overflow-hidden cursor-pointer group"
        onClick={() => bannerInputRef.current?.click()}
        title="Klik untuk ganti banner"
      >
        {/* Custom banner image */}
        {profile?.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.bannerUrl}
            alt="Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Decorative blobs (only show if no custom banner) */}
        {!profile?.bannerUrl && (
          <>
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-500/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
          </>
        )}
        <div className="absolute inset-0 bg-black/20" />
        {/* Edit overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {uploadingBanner ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Camera size={20} className="text-white" />
              <span className="text-white text-sm font-semibold">Ganti Banner</span>
            </>
          )}
        </div>
        {/* Hidden file input */}
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBannerUpload}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Avatar + Name */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6 mb-6">
          {/* Avatar */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 -mt-14 sm:-mt-16 z-20">
            <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-[#0070f3] to-purple-600 border-4 border-[#0a0a0a] shadow-2xl">
              {avatarUrl && !avatarError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white">
                  {initial}
                </div>
              )}
            </div>
            {/* Camera button → triggers avatar upload */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Ganti foto profil"
              className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-[#222] border border-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {uploadingAvatar
                ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <Camera size={13} />}
            </button>
            {/* Hidden avatar file input */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0 sm:pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName()
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                    className="bg-white/10 border border-white/20 rounded-xl px-3 py-1 text-xl font-black text-white outline-none focus:border-[#0070f3] w-48 sm:w-64"
                    maxLength={50}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="w-8 h-8 rounded-full bg-[#0070f3] flex items-center justify-center disabled:opacity-50"
                  >
                    <Check size={15} className="text-white" />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                  >
                    <X size={15} className="text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                    {displayName}
                  </h1>
                  <button
                    onClick={() => {
                      setNameValue(displayName)
                      setEditingName(true)
                    }}
                    className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                    title="Edit nama"
                  >
                    <Edit2 size={14} />
                  </button>
                </>
              )}
            </div>

            <p className="text-sm text-gray-400 mt-0.5 truncate">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-gray-500 mt-0.5">Bergabung {memberSince}</p>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {stats.map(({ icon: Icon, label, value, color, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-[#181818] hover:bg-[#222] border border-white/5 transition-all active:scale-95 group"
            >
              <Icon size={20} className={`${color} group-hover:scale-110 transition-transform`} />
              <span className="text-xl sm:text-2xl font-black text-white">{value}</span>
              <span className="text-[10px] sm:text-xs text-gray-400 font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Listening Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-[#181818] border border-white/5">
            <span className="text-base">🔥</span>
            <span className="text-lg font-black text-white">{streak}</span>
            <span className="text-[10px] text-gray-400 font-medium text-center leading-tight">Day Streak</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-[#181818] border border-white/5">
            <span className="text-base">⏱️</span>
            <span className="text-lg font-black text-white">{fmtTime(totalTime)}</span>
            <span className="text-[10px] text-gray-400 font-medium text-center leading-tight">Waktu Dengar</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-[#181818] border border-white/5">
            <span className="text-base">📊</span>
            <span className="text-lg font-black text-white">{fmtTime(avgTime)}</span>
            <span className="text-[10px] text-gray-400 font-medium text-center leading-tight">Rata-rata</span>
          </div>
        </div>

        {/* Recent Playlists */}
        {playlists.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-widest">Playlist Kamu</h2>
              <button
                onClick={() => router.push('/library')}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Lihat semua →
              </button>
            </div>
            <div className="space-y-2">
              {playlists.slice(0, 4).map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => router.push(`/playlist/${pl.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#181818] hover:bg-[#222] border border-white/5 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#2a2a2a] shrink-0 flex items-center justify-center">
                    {pl.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                    ) : (
                      <Music size={18} className="text-gray-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate group-hover:text-[#38bdf8] transition-colors">{pl.name}</p>
                    <p className="text-xs text-gray-400">{pl.songs?.length ?? 0} lagu</p>
                  </div>
                  <Play size={15} className="text-gray-600 group-hover:text-[#38bdf8] transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Quick Links */}
        <section className="mb-8">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-widest mb-3">Aktivitas</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/history')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-[#181818] hover:bg-[#222] border border-white/5 transition-all active:scale-95 text-left"
            >
              <Clock size={18} className="text-orange-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Riwayat</p>
                <p className="text-[10px] text-gray-400">Lagu terakhir</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/stats')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-[#181818] hover:bg-[#222] border border-white/5 transition-all active:scale-95 text-left"
            >
              <BarChart2 size={18} className="text-green-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Statistik</p>
                <p className="text-[10px] text-gray-400">Listening stats</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/liked')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-[#181818] hover:bg-[#222] border border-white/5 transition-all active:scale-95 text-left"
            >
              <Heart size={18} className="text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Favorit</p>
                <p className="text-[10px] text-gray-400">{likedTracks.length} lagu</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/queue')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-[#181818] hover:bg-[#222] border border-white/5 transition-all active:scale-95 text-left"
            >
              <Shuffle size={18} className="text-purple-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Antrean</p>
                <p className="text-[10px] text-gray-400">{queue.length} lagu</p>
              </div>
            </button>
          </div>
        </section>

        {/* Sign Out */}
        <div className="border-t border-white/10 pt-6 pb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all w-full text-sm font-bold"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
