import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  sidebarOpen: boolean
  queueOpen: boolean
  lyricsOpen: boolean
  lyricsMode: 'original' | 'romanized'
  theme: 'dark' | 'light'

  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setQueueOpen: (open: boolean) => void
  toggleQueue: () => void
  setLyricsOpen: (open: boolean) => void
  toggleLyrics: () => void
  setLyricsMode: (mode: 'original' | 'romanized') => void
  toggleLyricsMode: () => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      queueOpen: false,
      lyricsOpen: false,
      lyricsMode: 'original',
      theme: 'dark',

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setQueueOpen: (open) => set({ queueOpen: open }),
      toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
      setLyricsOpen: (open) => set({ lyricsOpen: open }),
      toggleLyrics: () => set((s) => ({ lyricsOpen: !s.lyricsOpen })),
      setLyricsMode: (mode) => set({ lyricsMode: mode }),
      toggleLyricsMode: () => set((s) => ({ lyricsMode: s.lyricsMode === 'original' ? 'romanized' : 'original' })),
    }),
    {
      name: 'localspo-ui',
    }
  )
)
