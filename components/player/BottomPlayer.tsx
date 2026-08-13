'use client'

import Link from 'next/link'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
  Mic2,
} from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import { useUIStore } from '@/store/uiStore'
import { useLikedTracks } from '@/lib/hooks/useLikedTracks'
import { formatDuration } from '@/lib/utils/formatDuration'

export function BottomPlayer() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    pause,
    resume,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
  } = usePlayerStore()
  const { queueOpen, lyricsOpen, toggleQueue, toggleLyrics } = useUIStore()
  const { isLiked, toggleLike } = useLikedTracks()

  if (!currentTrack) {
    return (
      <footer className="fixed bottom-3 sm:bottom-4 left-3 sm:left-6 right-3 sm:right-6 h-16 sm:h-20 bg-[#141414]/80 backdrop-blur-2xl border border-white/10 rounded-full z-50 px-4 sm:px-6 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3 text-xs text-[#8e9192]">
          <span className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
          <span className="truncate">LocalSpo — Select a track to play</span>
        </div>
      </footer>
    )
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const thumb = currentTrack.thumbnail ?? currentTrack.thumbnailUrl
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const pct = parseFloat(e.target.value)
    seek((pct / 100) * duration)
  }

  function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
    setVolume(parseFloat(e.target.value))
  }

  return (
    <footer className="fixed bottom-3 sm:bottom-4 left-2 sm:left-6 right-2 sm:right-6 h-18 sm:h-20 bg-[#141414]/90 backdrop-blur-2xl border border-white/12 rounded-full z-50 px-3 sm:px-5 md:px-6 flex items-center justify-between shadow-2xl gap-2">
      {/* Left: Track Info */}
      <div className="flex items-center gap-2 sm:gap-3 w-32 sm:w-44 md:w-56 lg:w-64 min-w-0 shrink">
        <Link href="/now-playing" className="relative group shrink-0">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={currentTrack.title}
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-lg border border-white/10 transition-transform group-hover:scale-105"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <span className="text-white/60 text-xs font-bold">♪</span>
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href="/now-playing"
            className="block text-xs sm:text-sm font-semibold truncate hover:text-white text-white/90 transition-colors"
          >
            {currentTrack.title}
          </Link>
          <p className="text-[11px] sm:text-xs text-[#c4c7c8] truncate">
            {currentTrack.artist?.name ?? 'Unknown Artist'}
          </p>
        </div>
        <button
          onClick={() => currentTrack && toggleLike(currentTrack)}
          className={`p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition-colors shrink-0 ${
            currentTrack && isLiked(currentTrack.id)
              ? 'text-red-500'
              : 'text-gray-400 hover:text-white'
          }`}
          aria-label={
            currentTrack && isLiked(currentTrack.id) ? 'Unlike' : 'Like'
          }
        >
          <Heart
            size={17}
            fill={currentTrack && isLiked(currentTrack.id) ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      {/* Center: Controls & Slider */}
      <div className="flex flex-col items-center gap-1 flex-1 max-w-xl px-1 sm:px-4 min-w-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={toggleShuffle}
            className={`p-1 sm:p-1.5 rounded-full transition-colors ${
              shuffle ? 'text-white font-bold bg-white/10' : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Shuffle"
          >
            <Shuffle size={15} />
          </button>

          <button
            onClick={previous}
            className="p-1 text-gray-300 hover:text-white transition-colors"
            aria-label="Previous"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>

          <button
            onClick={isPlaying ? pause : resume}
            disabled={isLoading}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10 disabled:opacity-50 shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause size={17} fill="currentColor" />
            ) : (
              <Play size={17} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            onClick={next}
            className="p-1 text-gray-300 hover:text-white transition-colors"
            aria-label="Next"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>

          <button
            onClick={toggleRepeat}
            className={`p-1 sm:p-1.5 rounded-full transition-colors ${
              repeat !== 'off' ? 'text-white font-bold bg-white/10' : 'text-gray-400 hover:text-white'
            }`}
            aria-label={`Repeat: ${repeat}`}
          >
            <RepeatIcon size={15} />
          </button>
        </div>

        {/* Scrub Bar */}
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          <span className="text-[10px] sm:text-[11px] font-mono text-[#8e9192] w-7 sm:w-8 text-right shrink-0">
            {formatDuration(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={handleSeek}
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progress}%, rgba(255, 255, 255, 0.2) ${progress}%, rgba(255, 255, 255, 0.2) 100%)`,
            }}
            className="flex-1 h-1 rounded-full cursor-pointer accent-white min-w-0"
            aria-label="Seek"
          />
          <span className="text-[10px] sm:text-[11px] font-mono text-[#8e9192] w-7 sm:w-8 shrink-0">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* Right: Audio options & volume */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          onClick={toggleLyrics}
          className={`p-1.5 sm:p-2 rounded-full transition-colors ${
            lyricsOpen ? 'text-white bg-white/20' : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Lyrics"
          title="Toggle Lyrics"
        >
          <Mic2 size={16} />
        </button>
        <button
          onClick={toggleQueue}
          className={`p-1.5 sm:p-2 rounded-full transition-colors ${
            queueOpen ? 'text-white bg-white/20' : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          aria-label="Queue"
          title="Toggle Queue"
        >
          <ListMusic size={16} />
        </button>
        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-white/10">
          <button
            onClick={toggleMute}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${(muted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) ${(muted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) 100%)`,
            }}
            className="w-16 lg:w-20 h-1 rounded-full cursor-pointer accent-white"
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  )
}
