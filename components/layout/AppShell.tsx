'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { BottomPlayer } from '../player/BottomPlayer'
import { AudioEngine } from '../player/AudioEngine'
import { TopBar } from './TopBar'
import { QueuePanel } from '../player/QueuePanel'
import { LyricsPanel } from '../lyrics/LyricsPanel'
import { useUIStore } from '@/store/uiStore'
import { usePlayerStore } from '@/store/playerStore'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { queueOpen, lyricsOpen, setLyricsOpen, sidebarOpen } = useUIStore()
  const { currentTrack, isPlaying } = usePlayerStore()
  const pathname = usePathname()

  // Auto-close lyrics overlay when navigating to another page
  useEffect(() => {
    setLyricsOpen(false)
  }, [pathname, setLyricsOpen])

  // Dynamic document title update for tab title
  useEffect(() => {
    if (currentTrack?.title) {
      const artist = currentTrack.artist?.name ? ` • ${currentTrack.artist.name}` : ''
      document.title = `${isPlaying ? '▶ ' : ''}${currentTrack.title}${artist} - LocalSpo`
    } else {
      document.title = 'LocalSpo - Web Player'
    }
  }, [currentTrack, isPlaying])

  // Global spacebar keyboard shortcut with repeat spam prevention
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' || e.key === ' ') {
        const target = e.target as HTMLElement | null
        const isInteractiveInput =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable

        if (isInteractiveInput) return

        // Ignore auto-repeated events from holding spacebar down
        if (e.repeat) {
          e.preventDefault()
          return
        }

        e.preventDefault()
        const state = usePlayerStore.getState()
        if (state.currentTrack) {
          if (state.isPlaying) {
            state.pause()
          } else {
            state.resume()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white overflow-hidden relative">
      {/* Audio engine — single hidden audio element */}
      <AudioEngine />

      {/* Floating Glass Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'md:pl-[280px]' : 'md:pl-[104px]'
        }`}
      >
        <TopBar />

        <main className="flex-1 overflow-y-auto pb-[108px] px-3 sm:px-6 relative">
          {lyricsOpen ? (
            <div className="h-full w-full bg-[#131313]/90 backdrop-blur-2xl border border-white/10 rounded-2xl relative overflow-hidden flex flex-col shadow-2xl">
              <div className="flex-1 overflow-hidden">
                <LyricsPanel />
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Queue Side Panel */}
      {queueOpen && <QueuePanel />}

      {/* Floating Capsule Bottom Player */}
      <BottomPlayer />
    </div>
  )
}
