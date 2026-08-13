import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  sidebarOpen: boolean
  queueOpen: boolean
  lyricsOpen: boolean
  theme: 'dark' | 'light'

  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setQueueOpen: (open: boolean) => void
  toggleQueue: () => void
  setLyricsOpen: (open: boolean) => void
  toggleLyrics: () => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      queueOpen: false,
      lyricsOpen: false,
      theme: 'dark',

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setQueueOpen: (open) => set({ queueOpen: open }),
      toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
      setLyricsOpen: (open) => set({ lyricsOpen: open }),
      toggleLyrics: () => set((s) => ({ lyricsOpen: !s.lyricsOpen })),
    }),
    {
      name: 'localspo-ui',
    }
  )
)
