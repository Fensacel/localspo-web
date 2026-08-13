import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from '@/types/track'
import type { RepeatMode } from '@/types/player'
import { recordArtist } from '@/lib/artistHistory'

interface PlayerStore {
  currentTrack: Track | null
  queue: Track[]
  originalQueue: Track[]
  userQueue: Track[] // Manually queued tracks ("Tambah ke antrean")
  contextTitle: string | null // Name of playlist / album / source
  currentIndex: number
  isPlaying: boolean
  isLoading: boolean
  isAutofilling: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  seekTo: number | null

  // Actions
  play: (track: Track, queue?: Track[], index?: number, contextTitle?: string) => void
  setQueue: (tracks: Track[], startIndex?: number, contextTitle?: string) => void
  updateQueueSongVideoId: (songId: string, videoId: string) => void
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
  removeFromUserQueue: (index: number) => void
  clearUserQueue: () => void
  clearQueue: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setIsPlaying: (playing: boolean) => void
  setIsLoading: (loading: boolean) => void
  autoFillRecommendations: () => Promise<void>
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      originalQueue: [],
      userQueue: [],
      contextTitle: null,
      currentIndex: -1,
      isPlaying: false,
      isLoading: false,
      isAutofilling: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      shuffle: false,
      repeat: 'off',
      seekTo: null,

      autoFillRecommendations: async () => {
        const { isAutofilling, queue, originalQueue, currentTrack } = get()
        if (isAutofilling) return
        set({ isAutofilling: true })

        try {
          // 1. Collect all unique artist names from the entire playlist / queue
          const baseSource = originalQueue.length > 0 ? originalQueue : queue
          const rawArtists = Array.from(
            new Set(
              baseSource
                .filter(Boolean)
                .map((t) => (typeof t!.artist === 'string' ? t!.artist : t!.artist?.name))
                .filter((name): name is string => Boolean(name && name.trim()))
            )
          )

          if (rawArtists.length === 0) {
            set({ isAutofilling: false })
            return
          }

          // 2. Shuffle artists completely randomly so NO single artist dominates
          const shuffledArtists = [...rawArtists]
          for (let i = shuffledArtists.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[shuffledArtists[i], shuffledArtists[j]] = [shuffledArtists[j], shuffledArtists[i]]
          }

          // 3. Pick up to 6 diverse artists from the playlist
          const selectedArtists = shuffledArtists.slice(0, 6)
          const newRecommendations: Track[] = []
          const existingIds = new Set(queue.map((t) => t.id))
          const existingTitles = new Set(queue.map((t) => t.title.toLowerCase().trim()))
          if (currentTrack) {
            existingIds.add(currentTrack.id)
            existingTitles.add(currentTrack.title.toLowerCase().trim())
          }

          // 4. Fetch songs from all selected artists in parallel
          const artistSongPromises = selectedArtists.map(async (artist) => {
            try {
              const res = await fetch(`/api/search?q=${encodeURIComponent(artist)}&type=songs`)
              const json = await res.json()
              const songs: Track[] = json.data?.songs || []
              return songs.filter((s) => {
                const normTitle = s.title.toLowerCase().trim()
                return !existingIds.has(s.id) && !existingTitles.has(normTitle)
              })
            } catch (err) {
              console.error('[Autoplay] Failed to fetch for artist:', artist, err)
              return []
            }
          })

          const artistSongsList = await Promise.all(artistSongPromises)

          // 5. Fair Round-Robin Interleaving (1 song per artist in rotation)
          const maxSongsPerArtist = 3
          for (let round = 0; round < maxSongsPerArtist; round++) {
            for (const songs of artistSongsList) {
              if (songs[round] && !newRecommendations.some((r) => r.id === songs[round].id)) {
                newRecommendations.push({
                  ...songs[round],
                  source: 'recommendation',
                })
                if (newRecommendations.length >= 18) break
              }
            }
            if (newRecommendations.length >= 18) break
          }

          if (newRecommendations.length > 0) {
            const currentQ = get().queue
            const currentOrig = get().originalQueue
            const updatedQueue = [...currentQ, ...newRecommendations]
            const updatedOrig = [...currentOrig, ...newRecommendations]

            const { isPlaying, currentIndex } = get()
            const wasAtEnd = currentIndex >= currentQ.length - 1

            if (!isPlaying || wasAtEnd) {
              const nextIndex = Math.max(0, currentQ.length)
              const nextTrack = updatedQueue[nextIndex]
              if (nextTrack?.artist?.name) {
                recordArtist(nextTrack.artist.name)
              }
              set({
                queue: updatedQueue,
                originalQueue: updatedOrig,
                currentTrack: nextTrack || get().currentTrack,
                currentIndex: nextIndex,
                isPlaying: true,
                currentTime: 0,
                duration: 0,
                seekTo: null,
                isAutofilling: false,
              })
            } else {
              set({
                queue: updatedQueue,
                originalQueue: updatedOrig,
                isAutofilling: false,
              })
            }
          } else {
            set({ isAutofilling: false })
          }
        } catch (e) {
          console.error('[autoFillRecommendations] Error:', e)
          set({ isAutofilling: false })
        }
      },

      play: (track, queue, index, contextTitle) => {
        const snapshotQueue = queue
          ? queue.map((t) => ({ ...t }))
          : [{ ...track }]
        let targetIndex = index
        if (targetIndex === undefined || targetIndex < 0) {
          targetIndex = snapshotQueue.findIndex((t) => t.id === track.id)
          if (targetIndex < 0) targetIndex = 0
        }

        if (track?.artist?.name) {
          recordArtist(track.artist.name)
        }

        const { shuffle, repeat } = get()
        let activeQueue = snapshotQueue
        let activeIndex = targetIndex

        if (shuffle && snapshotQueue.length > 1) {
          const current = snapshotQueue[targetIndex]
          const others = snapshotQueue.filter((_, i) => i !== targetIndex)
          for (let i = others.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[others[i], others[j]] = [others[j], others[i]]
          }
          activeQueue = [current, ...others]
          activeIndex = 0
        }

        set({
          currentTrack: activeQueue[activeIndex] || track,
          queue: activeQueue,
          originalQueue: snapshotQueue,
          currentIndex: activeIndex,
          contextTitle: contextTitle ?? track.album?.name ?? 'playlist',
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          seekTo: null,
        })

        // Preload autoplay recommendations if starting on a short queue
        if (activeQueue.length <= 2 && repeat === 'off') {
          setTimeout(() => {
            get().autoFillRecommendations()
          }, 1500)
        }
      },

      setQueue: (tracks, startIndex = 0, contextTitle) => {
        const snapshotQueue = tracks.map((t) => ({ ...t }))
        const targetIndex = Math.max(0, Math.min(startIndex, snapshotQueue.length - 1))
        const track = snapshotQueue[targetIndex] ?? null

        if (track?.artist?.name) {
          recordArtist(track.artist.name)
        }

        const { shuffle } = get()
        let activeQueue = snapshotQueue
        let activeIndex = targetIndex

        if (shuffle && snapshotQueue.length > 1) {
          const current = snapshotQueue[targetIndex]
          const others = snapshotQueue.filter((_, i) => i !== targetIndex)
          for (let i = others.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[others[i], others[j]] = [others[j], others[i]]
          }
          activeQueue = [current, ...others]
          activeIndex = 0
        }

        set({
          queue: activeQueue,
          originalQueue: snapshotQueue,
          currentIndex: activeIndex,
          currentTrack: activeQueue[activeIndex] ?? track,
          contextTitle: contextTitle ?? 'playlist',
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          seekTo: null,
        })
      },

      updateQueueSongVideoId: (songId, videoId) => {
        set((state) => ({
          queue: state.queue.map((t) => (t.id === songId ? { ...t, videoId } : t)),
          originalQueue: state.originalQueue.map((t) => (t.id === songId ? { ...t, videoId } : t)),
          userQueue: state.userQueue.map((t) => (t.id === songId ? { ...t, videoId } : t)),
          currentTrack:
            state.currentTrack?.id === songId
              ? { ...state.currentTrack, videoId }
              : state.currentTrack,
        }))
      },

      pause: () => set({ isPlaying: false }),
      resume: () => set({ isPlaying: true }),

      next: () => {
        const { userQueue, queue, currentIndex, repeat } = get()

        // 1. If there are manually queued user songs, play from userQueue first
        if (userQueue.length > 0) {
          const nextTrack = userQueue[0]
          if (nextTrack?.artist?.name) {
            recordArtist(nextTrack.artist.name)
          }
          set({
            currentTrack: nextTrack,
            userQueue: userQueue.slice(1),
            isPlaying: true,
            currentTime: 0,
            duration: 0,
            seekTo: null,
          })
          return
        }

        // 2. Play next from playlist queue
        if (!queue.length) return

        let nextIndex: number
        if (repeat === 'one') {
          nextIndex = currentIndex
        } else {
          nextIndex = currentIndex + 1
          if (nextIndex >= queue.length) {
            if (repeat === 'all') {
              nextIndex = 0
            } else {
              // Reached the end of queue: auto-fill recommendations from playlist artists
              get().autoFillRecommendations()
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

        // Preload upcoming recommendations in background when nearing the end
        if (nextIndex >= queue.length - 1 && repeat === 'off') {
          get().autoFillRecommendations()
        }
      },

      previous: () => {
        const { queue, currentIndex, currentTime } = get()
        if (!queue.length) return

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

      seek: (time) => set({ seekTo: time, currentTime: time }),

      clearSeek: () => set({ seekTo: null }),

      setVolume: (volume) =>
        set({ volume: Math.max(0, Math.min(1, volume)), muted: false }),

      toggleMute: () => set((s) => ({ muted: !s.muted })),

      addToQueue: (track) =>
        set((s) => ({
          userQueue: [...s.userQueue, { ...track }],
        })),

      playNext: (track) =>
        set((s) => ({
          userQueue: [{ ...track }, ...s.userQueue],
        })),

      removeFromQueue: (index) =>
        set((s) => {
          const next = [...s.queue]
          const removed = next.splice(index, 1)[0]
          const orig = s.originalQueue.filter((t) => t.id !== removed?.id)
          const newIndex =
            index < s.currentIndex
              ? s.currentIndex - 1
              : s.currentIndex
          return { queue: next, originalQueue: orig, currentIndex: newIndex }
        }),

      removeFromUserQueue: (index) =>
        set((s) => ({
          userQueue: s.userQueue.filter((_, i) => i !== index),
        })),

      clearUserQueue: () => set({ userQueue: [] }),

      clearQueue: () =>
        set({
          queue: [],
          originalQueue: [],
          userQueue: [],
          currentIndex: -1,
          currentTrack: null,
          contextTitle: null,
        }),

      toggleShuffle: () => {
        const { shuffle, queue, originalQueue, currentIndex, currentTrack } = get()
        const nextShuffle = !shuffle

        if (!queue.length) {
          set({ shuffle: nextShuffle })
          return
        }

        if (nextShuffle) {
          // Shuffle is turning ON: randomize upcoming queue while keeping currentTrack
          const baseOriginal = originalQueue.length > 0 ? originalQueue : [...queue]
          const current = currentTrack || queue[currentIndex]

          const beforeCurrent = queue.slice(0, currentIndex)
          const afterCurrent = queue.slice(currentIndex + 1)
          const remaining = [...beforeCurrent, ...afterCurrent]

          for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
          }

          const shuffledQueue = [current, ...remaining]
          set({
            shuffle: true,
            queue: shuffledQueue,
            originalQueue: baseOriginal,
            currentIndex: 0,
          })
        } else {
          // Shuffle is turning OFF: restore original playlist queue
          const baseOriginal = originalQueue.length > 0 ? originalQueue : [...queue]
          let originalIndex = 0
          if (currentTrack) {
            const found = baseOriginal.findIndex((t) => t.id === currentTrack.id)
            if (found >= 0) originalIndex = found
          }
          set({
            shuffle: false,
            queue: baseOriginal,
            currentIndex: originalIndex,
          })
        }
      },

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
        originalQueue: state.originalQueue,
        userQueue: state.userQueue,
        contextTitle: state.contextTitle,
        currentIndex: state.currentIndex,
        currentTrack: state.currentTrack,
      }),
    }
  )
)
