import { create } from 'zustand'

interface SleepTimerState {
  isActive: boolean
  mode: 'minutes' | 'songs' | 'end_of_track' | null
  targetMinutes: number
  targetSongs: number
  remainingSeconds: number | null
  remainingSongs: number | null
  startMinutesTimer: (minutes: number) => void
  startSongsTimer: (songs: number) => void
  startEndOfTrackTimer: () => void
  stopTimer: () => void
  decrementSongs: () => void
  tickSeconds: () => void
}

export const useSleepTimerStore = create<SleepTimerState>((set, get) => ({
  isActive: false,
  mode: null,
  targetMinutes: 30,
  targetSongs: 10,
  remainingSeconds: null,
  remainingSongs: null,

  startMinutesTimer: (minutes) => {
    set({
      isActive: true,
      mode: 'minutes',
      targetMinutes: minutes,
      remainingSeconds: minutes * 60,
      remainingSongs: null,
    })
  },

  startSongsTimer: (songs) => {
    set({
      isActive: true,
      mode: 'songs',
      targetSongs: songs,
      remainingSongs: songs,
      remainingSeconds: null,
    })
  },

  startEndOfTrackTimer: () => {
    set({
      isActive: true,
      mode: 'end_of_track',
      remainingSongs: 1,
      remainingSeconds: null,
    })
  },

  stopTimer: () => {
    set({
      isActive: false,
      mode: null,
      remainingSeconds: null,
      remainingSongs: null,
    })
  },

  decrementSongs: () => {
    const { remainingSongs, isActive, mode } = get()
    if (!isActive || (mode !== 'songs' && mode !== 'end_of_track')) return
    if (remainingSongs !== null) {
      const next = remainingSongs - 1
      if (next <= 0) {
        set({ isActive: false, mode: null, remainingSongs: 0 })
      } else {
        set({ remainingSongs: next })
      }
    }
  },

  tickSeconds: () => {
    const { remainingSeconds, isActive, mode } = get()
    if (!isActive || mode !== 'minutes') return
    if (remainingSeconds !== null) {
      const next = remainingSeconds - 1
      if (next <= 0) {
        set({ isActive: false, mode: null, remainingSeconds: 0 })
      } else {
        set({ remainingSeconds: next })
      }
    }
  },
}))
