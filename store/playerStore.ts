import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '@/types/track'
import type { RepeatMode } from '@/types/player'
import { recordArtist } from '@/lib/artistHistory'

interface PlayerStore {
  currentTrack: Track | null
  queue: Track[]
  currentIndex: number
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode

  // Explicit seek target — set by seek(), consumed + cleared by AudioEngine
  seekTo: number | null

  // Actions
  play: (track: Track, queue?: Track[], index?: number) => void
  pause: () => void
  resume: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  clearSeek: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  addToQueue: (track: Track) => void
  playNext: (track: Track) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setIsPlaying: (playing: boolean) => void
  setIsLoading: (loading: boolean) => void
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      shuffle: false,
      repeat: 'off',
      seekTo: null,

      play: (track, queue, index) => {
        const newQueue = queue ?? [track]
        const newIndex = index ?? 0
        if (track?.artist?.name) {
          recordArtist(track.artist.name)
        }
        set({
          currentTrack: track,
          queue: newQueue,
          currentIndex: newIndex,
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          seekTo: null,
        })
      },

      pause: () => set({ isPlaying: false }),
      resume: () => set({ isPlaying: true }),

      next: () => {
        const { queue, currentIndex, shuffle, repeat } = get()
        if (!queue.length) return

        let nextIndex: number
        if (shuffle) {
          nextIndex = Math.floor(Math.random() * queue.length)
        } else if (repeat === 'one') {
          nextIndex = currentIndex
        } else {
          nextIndex = currentIndex + 1
          if (nextIndex >= queue.length) {
            if (repeat === 'all') {
              nextIndex = 0
            } else {
              set({ isPlaying: false })
              return
            }
          }
        }

        const nextTrack = queue[nextIndex]
        if (nextTrack?.artist?.name) {
          recordArtist(nextTrack.artist.name)
        }
        set({
          currentTrack: nextTrack,
          currentIndex: nextIndex,
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          seekTo: null,
        })
      },

      previous: () => {
        const { queue, currentIndex, currentTime } = get()
        if (!queue.length) return

        // If more than 3s played, restart current track
        if (currentTime > 3) {
          set({ seekTo: 0, currentTime: 0 })
          return
        }

        const prevIndex = Math.max(0, currentIndex - 1)
        const prevTrack = queue[prevIndex]
        if (prevTrack?.artist?.name) {
          recordArtist(prevTrack.artist.name)
        }
        set({
          currentTrack: prevTrack,
          currentIndex: prevIndex,
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          seekTo: null,
        })
      },

      // Explicit seek — sets seekTo which AudioEngine watches
      seek: (time) => set({ seekTo: time, currentTime: time }),

      clearSeek: () => set({ seekTo: null }),

      setVolume: (volume) =>
        set({ volume: Math.max(0, Math.min(1, volume)), muted: false }),

      toggleMute: () => set((s) => ({ muted: !s.muted })),

      addToQueue: (track) =>
        set((s) => ({ queue: [...s.queue, track] })),

      playNext: (track) =>
        set((s) => {
          const next = [...s.queue]
          next.splice(s.currentIndex + 1, 0, track)
          return { queue: next }
        }),

      removeFromQueue: (index) =>
        set((s) => {
          const next = [...s.queue]
          next.splice(index, 1)
          const newIndex =
            index < s.currentIndex
              ? s.currentIndex - 1
              : s.currentIndex
          return { queue: next, currentIndex: newIndex }
        }),

      clearQueue: () => set({ queue: [], currentIndex: -1, currentTrack: null }),

      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

      toggleRepeat: () =>
        set((s) => ({
          repeat:
            s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
        })),

      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'localspo-player',
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        shuffle: state.shuffle,
        repeat: state.repeat,
        queue: state.queue,
        currentIndex: state.currentIndex,
        currentTrack: state.currentTrack,
        // Do NOT persist seekTo, isPlaying, currentTime, duration
      }),
    }
  )
)
