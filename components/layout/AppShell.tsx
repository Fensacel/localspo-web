'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { BottomPlayer } from '../player/BottomPlayer'
import { AudioEngine } from '../player/AudioEngine'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { ToastContainer } from '../ui/ToastContainer'
import { useUIStore } from '@/store/uiStore'
import { usePlayerStore } from '@/store/playerStore'
import { LyricsPanel } from '@/components/lyrics/LyricsPanel'
import { QueuePanel } from '@/components/player/QueuePanel'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { queueOpen, lyricsOpen, setLyricsOpen, sidebarOpen } = useUIStore()
  const { currentTrack, isPlaying } = usePlayerStore()
  const pathname = usePathname()

  // Auto-close lyrics overlay when navigating to another page
  useEffect(() => {
    setLyricsOpen(false)
  }, [pathname, setLyricsOpen])

  // Register PWA Service Worker for true standalone app install
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err)
      })
    }
  }, [])

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
      {/* Global In-App Toast Notifications */}
      <ToastContainer />

      {/* Audio engine — single hidden audio element */}
      <AudioEngine />

      {/* Floating Glass Sidebar (Desktop only) */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'md:pl-[280px]' : 'md:pl-[104px]'
        }`}
      >
        <TopBar />

        <main
          className={`flex-1 overflow-y-auto relative ${
            pathname === '/now-playing'
              ? 'p-0 pb-0'
              : 'pb-[140px] md:pb-[108px] px-3 sm:px-6'
          }`}
        >
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

      {/* Floating Capsule Bottom Player (hidden on full now-playing screen) */}
      {pathname !== '/now-playing' && (
        <div className="md:contents">
          <div className="fixed bottom-[58px] md:bottom-0 left-0 right-0 z-40">
            <BottomPlayer />
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Home / Search / Library / Favorites) */}
      <MobileNav />
    </div>
  )
}
