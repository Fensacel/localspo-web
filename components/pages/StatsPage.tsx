'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'

type Period = 'today' | 'week' | 'month' | 'year'

interface RawHistoryItem {
  id?: string
  track_id?: string
  title?: string
  artist?: { name: string } | string
  album?: { name: string } | string
  thumbnail?: string
  thumbnailUrl?: string
  thumbnail_url?: string
  played_at?: string
  duration?: number
  progress?: number
}

interface NormalizedHistory {
  track_id: string
  title: string
  artist: string
  album: string
  thumbnail: string
  played_at: string
  duration: number
}

function formatListeningTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m ${s}s`
  }
  const hours = Math.floor(seconds / 3600)
  const remainingSecs = seconds % 3600
  const m = Math.floor(remainingSecs / 60)
  const s = Math.round(remainingSecs % 60)

  if (hours >= 24) {
    const d = Math.floor(hours / 24)
    const h = hours % 24
    return `${d}d ${h}h`
  }
  return s > 0 ? `${hours}h ${m}m` : `${hours}h ${m}m`
}

function computeStreak(entries: NormalizedHistory[]): number {
  if (!entries.length) return 0
  const dates = new Set<string>()
  entries.forEach((e) => {
    if (e.played_at) {
      dates.add(new Date(e.played_at).toDateString())
    }
  })

  let streak = 0
  const checkDate = new Date()

  // Check today first, if not played today check yesterday to start streak
  if (!dates.has(checkDate.toDateString())) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  while (dates.has(checkDate.toDateString())) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }
  return streak
}

function MediaStatRow({
  title,
  subtitle,
  count,
  thumbnail,
}: {
  title: string
  subtitle?: string
  count: number | string
  thumbnail?: string
}) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] transition-all">
      <div className="w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-white/10 relative">
        {thumbnail && !imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 font-mono text-sm">♪</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
      </div>
      <div className="text-right shrink-0">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-gray-300">
          {count}
        </span>
      </div>
    </div>
  )
}

export function StatsPage() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState<Period>('week')
  const [localEntries, setLocalEntries] = useState<NormalizedHistory[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('localspo_history')
      if (stored) {
        const rawArr: RawHistoryItem[] = JSON.parse(stored)
        const normalized = rawArr.map((h) => ({
          track_id: h.id || h.track_id || 'unknown',
          title: h.title || 'Unknown Track',
          artist: typeof h.artist === 'string' ? h.artist : h.artist?.name || 'Unknown Artist',
          album: typeof h.album === 'string' ? h.album : h.album?.name || 'Single',
          thumbnail: h.thumbnail || h.thumbnailUrl || h.thumbnail_url || '',
          played_at: h.played_at || new Date().toISOString(),
          duration: h.duration || 180,
        }))
        setLocalEntries(normalized)
      }
    } catch {}
  }, [])

  const { data: apiData, isLoading } = useQuery<RawHistoryItem[]>({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch('/api/history')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })

  const apiEntries: NormalizedHistory[] = (apiData ?? []).map((h) => ({
    track_id: h.id || h.track_id || 'unknown',
    title: h.title || 'Unknown Track',
    artist: typeof h.artist === 'string' ? h.artist : h.artist?.name || 'Unknown Artist',
    album: typeof h.album === 'string' ? h.album : h.album?.name || 'Single',
    thumbnail: h.thumbnail || h.thumbnailUrl || h.thumbnail_url || '',
    played_at: h.played_at || new Date().toISOString(),
    duration: h.duration || 180,
  }))

  const rawEntries = user && apiEntries.length > 0 ? apiEntries : localEntries

  const now = new Date()
  const filtered = rawEntries.filter((h) => {
    if (!h.played_at) return true
    const d = new Date(h.played_at)
    if (period === 'today') return d.toDateString() === now.toDateString()
    if (period === 'week') return now.getTime() - d.getTime() < 7 * 86400000
    if (period === 'month') return now.getTime() - d.getTime() < 30 * 86400000
    if (period === 'year') return now.getTime() - d.getTime() < 365 * 86400000
    return true
  })

  const totalPlays = filtered.length
  const totalTime = filtered.reduce((acc, h) => acc + (h.duration || 0), 0)
  const avgTime = totalPlays > 0 ? Math.round(totalTime / totalPlays) : 0
  const streak = computeStreak(rawEntries)

  // Aggregations
  const songMap: Record<string, { title: string; artist: string; thumbnail: string; count: number }> = {}
  const artistMap: Record<string, { name: string; thumbnail: string; count: number }> = {}
  const albumMap: Record<string, { name: string; artist: string; thumbnail: string; count: number }> = {}

  for (const h of filtered) {
    // Songs
    if (!songMap[h.track_id]) {
      songMap[h.track_id] = { title: h.title, artist: h.artist, thumbnail: h.thumbnail, count: 0 }
    }
    songMap[h.track_id].count++

    // Artists
    if (h.artist) {
      if (!artistMap[h.artist]) {
        artistMap[h.artist] = { name: h.artist, thumbnail: h.thumbnail, count: 0 }
      }
      artistMap[h.artist].count++
    }

    // Albums
    if (h.album && h.album !== 'Single') {
      if (!albumMap[h.album]) {
        albumMap[h.album] = { name: h.album, artist: h.artist, thumbnail: h.thumbnail, count: 0 }
      }
      albumMap[h.album].count++
    }
  }

  const topSongs = Object.values(songMap).sort((a, b) => b.count - a.count).slice(0, 5)
  const topArtists = Object.values(artistMap).sort((a, b) => b.count - a.count).slice(0, 5)
  const topAlbums = Object.values(albumMap).sort((a, b) => b.count - a.count).slice(0, 5)
  const recentlyPlayed = filtered.slice(0, 5)

  const periods: { id: Period; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
  ]

  if (isLoading && !localEntries.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
        Calculating stats…
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Your Music Stats</h1>
            <p className="text-xs text-gray-400 mt-1">Listening activity and top choices</p>
          </div>

          <div className="flex gap-1.5 p-1 rounded-full bg-white/5 border border-white/10 self-start sm:self-auto">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  period === p.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Plays" value={String(totalPlays)} icon="🎵" />
          <StatCard label="Listening Time" value={formatListeningTime(totalTime)} icon="⏱️" />
          <StatCard label="Avg Track Time" value={formatListeningTime(avgTime)} icon="📊" />
          <StatCard label="Day Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} icon="🔥" />
        </div>

        {/* Detailed Breakdown */}
        {totalPlays === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl border border-white/5">
            <p className="text-gray-400 text-sm">No listening history found for this period.</p>
            <p className="text-xs text-gray-500 mt-1">Play your favorite tracks to populate your statistics!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Songs */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-wider uppercase flex items-center gap-2">
                <span>🔥</span> Top Songs
              </h2>
              <div className="space-y-2">
                {topSongs.map((song, i) => (
                  <MediaStatRow
                    key={i}
                    title={song.title}
                    subtitle={song.artist}
                    count={`${song.count} plays`}
                    thumbnail={song.thumbnail}
                  />
                ))}
              </div>
            </div>

            {/* Top Artists */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-wider uppercase flex items-center gap-2">
                <span>🎤</span> Top Artists
              </h2>
              <div className="space-y-2">
                {topArtists.length > 0 ? (
                  topArtists.map((artist, i) => (
                    <MediaStatRow
                      key={i}
                      title={artist.name}
                      count={`${artist.count} plays`}
                      thumbnail={artist.thumbnail}
                    />
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No artist breakdown available.</p>
                )}
              </div>
            </div>

            {/* Top Albums */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-wider uppercase flex items-center gap-2">
                <span>💿</span> Top Albums
              </h2>
              <div className="space-y-2">
                {topAlbums.length > 0 ? (
                  topAlbums.map((album, i) => (
                    <MediaStatRow
                      key={i}
                      title={album.name}
                      subtitle={album.artist}
                      count={`${album.count} plays`}
                      thumbnail={album.thumbnail}
                    />
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No album breakdown available.</p>
                )}
              </div>
            </div>

            {/* Recently Played */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
              <h2 className="text-sm font-semibold text-white tracking-wider uppercase flex items-center gap-2">
                <span>🕒</span> Recently Played
              </h2>
              <div className="space-y-2">
                {recentlyPlayed.map((item, i) => (
                  <MediaStatRow
                    key={i}
                    title={item.title}
                    subtitle={item.artist}
                    count={formatTimeAgo(item.played_at)}
                    thumbnail={item.thumbnail}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="glass-panel p-4 rounded-2xl border border-white/5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{value}</p>
    </div>
  )
}

function formatTimeAgo(isoString: string): string {
  if (!isoString) return ''
  const diffSec = Math.floor((new Date().getTime() - new Date(isoString).getTime()) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}
