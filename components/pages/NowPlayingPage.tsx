'use client'

import { usePlayerStore } from '@/store/playerStore'
import { useLikedTracks } from '@/lib/hooks/useLikedTracks'
import { formatDuration } from '@/lib/utils/formatDuration'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ChevronDown,
  Volume2,
  VolumeX,
  Maximize2,
  Cloud,
  Home,
  Search,
  Library,
  MoreVertical,
  X,
  ListMusic,
  Share2,
  Mic2,
  Clock,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LyricsPanel } from '@/components/lyrics/LyricsPanel'
import { TrackContextMenu } from '@/components/music/TrackContextMenu'
import { SleepTimerModal } from '@/components/player/SleepTimerModal'
import { useSleepTimerStore } from '@/store/useSleepTimerStore'

export function NowPlayingPage() {
  const {
    currentTrack,
    queue,
    currentIndex,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    shuffle,
    repeat,
    pause,
    resume,
    next,
    previous,
    seek,
    play,
    toggleShuffle,
    toggleRepeat,
  } = usePlayerStore()
  const { isLiked, toggleLike } = useLikedTracks()
  const [imgError, setImgError] = useState(false)
  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player')
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const { isActive: sleepActive } = useSleepTimerStore()
  const router = useRouter()

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const remainingTime = Math.max(0, duration - currentTime)
  const thumb = currentTrack?.thumbnail ?? currentTrack?.thumbnailUrl
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  if (!currentTrack) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 text-gray-400 p-6 min-h-[80vh]">
        <span className="text-6xl animate-bounce">🎵</span>
        <p className="text-xl font-bold text-white">Nothing playing</p>
        <p className="text-sm text-gray-400">Search for a song or choose a playlist to start listening</p>
        <button
          onClick={() => router.push('/search')}
          className="mt-4 px-6 py-2.5 rounded-full bg-white text-black font-bold text-sm hover:scale-105 transition-all shadow-lg"
        >
          Explore Music
        </button>
      </div>
    )
  }

  const artistName =
    typeof currentTrack.artist === 'string'
      ? currentTrack.artist
      : currentTrack.artist?.name || 'Unknown Artist'
  const albumName =
    typeof currentTrack.album === 'string'
      ? currentTrack.album
      : currentTrack.album?.name || 'Single'

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col justify-between overflow-hidden bg-black text-white selection:bg-white/20 z-50">
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover blur-[130px] opacity-40 scale-150 saturate-200 transition-all duration-700"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/95" />
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: DEDICATED LYRICS MODE                              */}
      {/* ========================================================= */}
      {activeTab === 'lyrics' ? (
        <div className="relative z-10 flex-1 flex flex-col justify-between h-full max-w-lg w-full mx-auto overflow-hidden">
          {/* Top Compact Track Header (Click cover/title to switch to player) */}
          <header className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-white/10">
            <div
              onClick={() => setActiveTab('player')}
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group select-none"
              title="Ketuk untuk kembali ke pemutar"
            >
              {/* Cover Art Thumbnail */}
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#181818] border border-white/15 shrink-0 shadow-md group-hover:scale-105 transition-transform">
                {thumb && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs">♪</div>
                )}
              </div>

              {/* Title & Artist */}
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-extrabold text-white truncate group-hover:text-[#38bdf8] transition-colors">
                  {currentTrack.title}
                </h1>
                <p className="text-xs text-gray-300 truncate mt-0.5">
                  {artistName} {albumName ? `— ${albumName}` : ''}
                </p>
              </div>
            </div>

            {/* 3-Dots Context Menu Button */}
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setContextMenu({ x: rect.left, y: rect.bottom + 4 })
              }}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all active:scale-95 shrink-0"
              title="Opsi lagu"
            >
              <MoreVertical size={16} />
            </button>
          </header>

          {/* Synchronized Scrolling Lyrics Center */}
          <div className="flex-1 overflow-hidden min-h-0 relative">
            <LyricsPanel />
          </div>

          {/* Bottom Floating Mini Controller Pill */}
          <div className="shrink-0 px-4 pt-1 pb-2">
            <div className="w-full bg-[#141414]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-2.5 shadow-2xl">
              <div className="flex items-center justify-between gap-2.5">
                {/* Mini cover + title (Click to switch to player) */}
                <div
                  onClick={() => setActiveTab('player')}
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group select-none"
                  title="Ketuk untuk kembali ke pemutar"
                >
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0 group-hover:scale-105 transition-transform"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-[#38bdf8] transition-colors">
                      {currentTrack.title}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{artistName}</p>
                  </div>
                </div>

                <button
                  onClick={isPlaying ? pause : resume}
                  disabled={isLoading}
                  className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shrink-0 disabled:opacity-50"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                </button>
              </div>

              {/* Scrub Slider */}
              <div className="w-full mt-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => seek((parseFloat(e.target.value) / 100) * duration)}
                  style={{
                    background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progress}%, rgba(255, 255, 255, 0.2) ${progress}%, rgba(255, 255, 255, 0.2) 100%)`,
                  }}
                  className="w-full h-1 rounded-full cursor-pointer accent-white"
                  aria-label="Seek"
                />
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'queue' ? (
        /* ========================================================= */
        /* VIEW 2: SPOTIFY STYLE QUEUE LIST MODE                      */
        /* ========================================================= */
        <div className="relative z-10 flex-1 flex flex-col justify-between h-full max-w-lg w-full mx-auto px-4 pt-3 overflow-hidden">
          {/* Top Header */}
          <header className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <ListMusic size={20} className="text-[#38bdf8]" />
              <h2 className="text-base font-extrabold text-white">Antrean Pemutaran</h2>
            </div>
            <button
              onClick={() => setActiveTab('player')}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all active:scale-95"
              aria-label="Tutup antrean"
            >
              <X size={18} />
            </button>
          </header>

          {/* Scrollable Queue Content */}
          <div className="flex-1 overflow-y-auto my-3 space-y-4 pr-1">
            {/* Section 1: Sedang Diputar (Now Playing) */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                Sedang Diputar
              </p>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/15 border border-white/20 shadow-lg">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={currentTrack.title}
                    className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">♪</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#38bdf8] truncate leading-tight">
                    {currentTrack.title}
                  </p>
                  <p className="text-xs text-gray-300 truncate mt-0.5">{artistName}</p>
                </div>
                <span className="text-xs font-mono text-gray-400 shrink-0">
                  {formatDuration(duration)}
                </span>
              </div>
            </div>

            {/* Section 2: Berikutnya (Next Up) */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
                Berikutnya dari antrean ({queue.length - 1 > 0 ? queue.length - 1 : 0} lagu)
              </p>

              {queue.length <= 1 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  Tidak ada lagu lain dalam antrean.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {queue.map((track, idx) => {
                    if (idx === currentIndex) return null
                    const trackThumb = track.thumbnail ?? track.thumbnailUrl
                    const tArtist =
                      typeof track.artist === 'string'
                        ? track.artist
                        : track.artist?.name || 'Unknown Artist'

                    return (
                      <div
                        key={track.id || idx}
                        onClick={() => play(track, queue, idx)}
                        className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.99] cursor-pointer transition-all border border-white/5"
                      >
                        <span className="text-xs font-mono w-5 text-center text-gray-400 shrink-0">
                          {idx + 1}
                        </span>
                        {trackThumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={trackThumb}
                            alt={track.title}
                            className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">♪</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate leading-tight">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{tArtist}</p>
                        </div>
                        <span className="text-xs font-mono text-gray-400 shrink-0">
                          {formatDuration(track.duration || 0)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW 3: EXACT SPOTIFY SCREENSHOT PLAYER MODE               */
        /* ========================================================= */
        <div className="relative z-10 flex-1 flex flex-col justify-between max-w-sm sm:max-w-md w-full mx-auto px-6 pt-3 pb-3">
          {/* Top Back / Header */}
          <header className="flex items-center justify-between pb-1">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-all active:scale-95"
              aria-label="Back"
            >
              <ChevronDown size={24} />
            </button>

            <div className="text-center min-w-0 flex-1 px-2">
              <p className="text-xs font-semibold text-white truncate">{albumName}</p>
            </div>

            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setContextMenu({ x: rect.left - 120, y: rect.bottom + 4 })
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-all active:scale-95"
              title="Opsi lagu"
            >
              <MoreVertical size={18} />
            </button>
          </header>

          {/* 1. Large Rounded Cover Art */}
          <div className="relative w-full aspect-square max-w-[320px] sm:max-w-[340px] mx-auto rounded-3xl overflow-hidden bg-[#181818] shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/10 shrink-0">
            {thumb && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl text-gray-700">♪</div>
            )}
          </div>

          {/* 2. Progress Slider & Timestamps (Under Cover Art) */}
          <div className="w-full mt-4">
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => seek((parseFloat(e.target.value) / 100) * duration)}
              style={{
                background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progress}%, rgba(255, 255, 255, 0.25) ${progress}%, rgba(255, 255, 255, 0.25) 100%)`,
              }}
              className="w-full h-1 rounded-full cursor-pointer accent-white"
              aria-label="Seek"
            />
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 mt-1.5 px-0.5">
              <span>{formatDuration(currentTime)}</span>
              <span>-{formatDuration(remainingTime)}</span>
            </div>
          </div>

          {/* 3. Title, Artist & Like Button Row */}
          <div className="flex items-center justify-between w-full mt-2">
            <div className="min-w-0 flex-1 pr-3">
              <h1 className="text-2xl font-black text-white tracking-tight truncate leading-tight">
                {currentTrack.title}
              </h1>
              <p className="text-sm font-semibold text-gray-300 truncate mt-0.5">{artistName}</p>
            </div>

            <button
              onClick={() => toggleLike(currentTrack)}
              className={`p-2 transition-all active:scale-90 shrink-0 ${
                isLiked(currentTrack.id) ? 'text-red-500' : 'text-gray-400 hover:text-white'
              }`}
              aria-label="Like"
            >
              <Heart size={24} fill={isLiked(currentTrack.id) ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* 4. Playback Controls Row: [Shuffle] [Prev] [Play/Pause] [Next] [Repeat] */}
          <div className="flex items-center justify-between w-full px-2 mt-4">
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              className={`p-2 transition-colors active:scale-90 ${
                shuffle ? 'text-[#38bdf8]' : 'text-gray-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle size={20} />
            </button>

            {/* Previous Track */}
            <button
              onClick={previous}
              className="p-2 text-white hover:text-white/80 active:scale-90 transition-all"
              aria-label="Previous Track"
            >
              <SkipBack size={24} fill="currentColor" />
            </button>

            {/* Big Circular White Play/Pause Button */}
            <button
              onClick={isPlaying ? pause : resume}
              disabled={isLoading}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.25)] disabled:opacity-50"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <span className="w-6 h-6 border-3 border-black border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" className="ml-1" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={next}
              className="p-2 text-white hover:text-white/80 active:scale-90 transition-all"
              aria-label="Next Track"
            >
              <SkipForward size={24} fill="currentColor" />
            </button>

            {/* Repeat */}
            <button
              onClick={toggleRepeat}
              className={`p-2 transition-colors active:scale-90 ${
                repeat !== 'off' ? 'text-[#38bdf8]' : 'text-gray-400 hover:text-white'
              }`}
              title={`Repeat: ${repeat}`}
            >
              <RepeatIcon size={20} />
            </button>
          </div>

          {/* 5. Bottom Utilities: [Timer] on Left | [Lirik] [Queue] on Right */}
          <div className="flex items-center justify-between w-full mt-3 px-2">
            {/* Left: Sleep Timer */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSleepModalOpen(true)}
                className={`p-2 transition-colors active:scale-90 flex items-center gap-1 ${
                  sleepActive ? 'text-[#38bdf8]' : 'text-gray-400 hover:text-white'
                }`}
                title="Sleep Timer"
              >
                <Clock size={19} />
                {sleepActive && (
                  <span className="text-[10px] font-bold">ON</span>
                )}
              </button>
            </div>

            {/* Right: Lirik & Antrean/Queue */}
            <div className="flex items-center gap-3">
              {/* Lirik Icon Button */}
              <button
                onClick={() => setActiveTab('lyrics')}
                className="p-2 text-gray-400 hover:text-white transition-colors active:scale-90 flex items-center gap-1.5"
                title="Buka Lirik"
              >
                <Mic2 size={20} />
              </button>

              {/* Queue Icon Button */}
              <button
                onClick={() => setActiveTab('queue')}
                className="p-2 text-gray-400 hover:text-white transition-colors active:scale-90 flex items-center gap-1.5"
                title="Lihat Antrean Lagu"
              >
                <ListMusic size={20} />
              </button>
            </div>
          </div>

          {/* Sleep Timer Modal */}
          <SleepTimerModal
            isOpen={isSleepModalOpen}
            onClose={() => setIsSleepModalOpen(false)}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* BOTTOM NAVIGATION BAR (IDENTICAL TO HOME NAV)             */}
      {/* ========================================================= */}
      <footer className="relative z-20 w-full bg-[#0a0a0a]/95 backdrop-blur-2xl border-t border-white/10 pt-1.5 pb-[env(safe-area-inset-bottom,6px)] px-3">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* 1. Home */}
          <button
            onClick={() => router.push('/')}
            className="flex flex-col items-center gap-1 py-1 px-4 text-gray-400 hover:text-white transition-all"
          >
            <Home size={20} />
            <span className="text-[10px] font-medium">Home</span>
          </button>

          {/* 2. Search */}
          <button
            onClick={() => router.push('/search')}
            className="flex flex-col items-center gap-1 py-1 px-4 text-gray-400 hover:text-white transition-all"
          >
            <Search size={20} />
            <span className="text-[10px] font-medium">Search</span>
          </button>

          {/* 3. Library */}
          <button
            onClick={() => router.push('/library')}
            className="flex flex-col items-center gap-1 py-1 px-4 text-gray-400 hover:text-white transition-all"
          >
            <Library size={20} />
            <span className="text-[10px] font-medium">Library</span>
          </button>

          {/* 4. Favorites */}
          <button
            onClick={() => router.push('/liked')}
            className="flex flex-col items-center gap-1 py-1 px-4 text-gray-400 hover:text-white transition-all"
          >
            <Heart size={20} />
            <span className="text-[10px] font-medium">Favorites</span>
          </button>
        </div>
      </footer>

      {/* Context Menu Modal */}
      {contextMenu && currentTrack && (
        <TrackContextMenu
          track={currentTrack}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
