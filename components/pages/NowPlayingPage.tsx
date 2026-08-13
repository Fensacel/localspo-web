'use client'

import { usePlayerStore } from '@/store/playerStore'
import { useLikedTracks } from '@/lib/hooks/useLikedTracks'
import { formatDuration } from '@/lib/utils/formatDuration'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Heart } from 'lucide-react'
import { useState } from 'react'
import { LyricsPanel } from '@/components/lyrics/LyricsPanel'

export function NowPlayingPage() {
  const {
    currentTrack, isPlaying, isLoading,
    currentTime, duration, volume, muted,
    shuffle, repeat,
    pause, resume, next, previous, seek,
    setVolume, toggleMute, toggleShuffle, toggleRepeat,
  } = usePlayerStore()
  const { isLiked, toggleLike } = useLikedTracks()
  const [imgError, setImgError] = useState(false)

  if (!currentTrack) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 text-gray-400">
        <span className="text-6xl">🎵</span>
        <p className="text-lg">Nothing playing</p>
        <p className="text-sm">Search for a song to start listening</p>
      </div>
    )
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const thumb = currentTrack.thumbnail ?? currentTrack.thumbnailUrl
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 h-full">
        <div className="flex flex-col lg:flex-row gap-8 h-full">
          {/* Left: Cover + Controls */}
          <div className="flex flex-col items-center gap-6 lg:w-1/2">
            {/* Cover */}
            <div className="w-64 h-64 lg:w-80 lg:h-80 rounded-2xl overflow-hidden bg-[#1e1e1e] shadow-2xl shrink-0">
              {thumb && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt={currentTrack.title}
                  className="object-cover w-full h-full"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-7xl text-gray-700">♪</div>
              )}
            </div>

            {/* Track info */}
            <div className="text-center relative group">
              <div className="flex items-center justify-center gap-3">
                <h1 className="text-2xl font-bold">{currentTrack.title}</h1>
                <button
                  onClick={() => toggleLike(currentTrack)}
                  className={`transition-colors ${
                    isLiked(currentTrack.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-400'
                  }`}
                  aria-label={isLiked(currentTrack.id) ? 'Unlike' : 'Like'}
                >
                  <Heart size={20} fill={isLiked(currentTrack.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p className="text-gray-400 mt-1">{currentTrack.artist?.name}</p>
              {currentTrack.album?.name && (
                <p className="text-gray-500 text-sm mt-0.5">{currentTrack.album.name}</p>
              )}
            </div>

            {/* Progress */}
            <div className="w-full max-w-md flex items-center gap-3">
              <span className="text-xs text-gray-500 w-10 text-right">{formatDuration(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => seek((parseFloat(e.target.value) / 100) * duration)}
                className="flex-1 h-1.5 accent-white"
                aria-label="Seek"
              />
              <span className="text-xs text-gray-500 w-10">{formatDuration(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-5">
              <button
                onClick={toggleShuffle}
                className={`${shuffle ? 'text-blue-400' : 'text-gray-500 hover:text-white'}`}
                aria-label="Shuffle"
              >
                <Shuffle size={20} />
              </button>
              <button onClick={previous} className="text-gray-300 hover:text-white" aria-label="Previous">
                <SkipBack size={24} fill="currentColor" />
              </button>
              <button
                onClick={isPlaying ? pause : resume}
                disabled={isLoading}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 shadow-lg"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause size={24} fill="currentColor" />
                ) : (
                  <Play size={24} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button onClick={next} className="text-gray-300 hover:text-white" aria-label="Next">
                <SkipForward size={24} fill="currentColor" />
              </button>
              <button
                onClick={toggleRepeat}
                className={`${repeat !== 'off' ? 'text-blue-400' : 'text-gray-500 hover:text-white'}`}
                aria-label={`Repeat: ${repeat}`}
              >
                <RepeatIcon size={20} />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-gray-500 hover:text-white" aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-28 h-1.5 accent-white"
                aria-label="Volume"
              />
            </div>
          </div>

          {/* Right: Lyrics */}
          <div className="lg:w-1/2 h-[500px] lg:h-auto overflow-hidden rounded-xl bg-white/5">
            <LyricsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
