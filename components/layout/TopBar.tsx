'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Menu, Clock, User, BarChart2, Download, LogOut, LogIn, Smartphone } from 'lucide-react'
import { UserMenu } from '../auth/UserMenu'
import { SearchBar } from '../music/SearchBar'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { createClient } from '@/lib/supabase/client'
import { ImportPlaylistModal } from '@/components/playlist/ImportPlaylistModal'
import { triggerPWAInstall } from '@/components/pwa/PWAInstallPrompt'

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile } = useAuthStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  // Hide TopBar completely on now-playing page
  if (pathname === '/now-playing') return null

  const isHome = pathname === '/'
  const avatar = profile?.avatarUrl ?? user?.user_metadata?.avatar_url
  const name = profile?.displayName ?? user?.user_metadata?.full_name ?? user?.email ?? 'User'
  const initial = (name.charAt(0) || 'U').toUpperCase()

  async function handleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setDropdownOpen(false)
    router.push('/')
  }

  function navigate(href: string) {
    setDropdownOpen(false)
    router.push(href)
  }

  return (
    <>
      <header
        className={`${
          isHome ? 'flex' : 'hidden sm:flex'
        } sticky top-0 h-14 sm:h-16 w-full z-30 bg-[#050505]/75 backdrop-blur-xl items-center justify-between px-4 sm:px-6 mb-2 gap-2 sm:gap-4`}
      >
        {/* Mobile Brand Logo */}
        <div className="flex sm:hidden items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="LocalSpo" className="w-7 h-7 rounded-lg" />
            <span className="font-black text-sm tracking-tight text-white">LocalSpo</span>
          </Link>
        </div>

        {/* Navigation controls (Desktop only) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all shadow"
            aria-label="Go back"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => router.forward()}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all shadow"
            aria-label="Go forward"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Search bar (Desktop only) */}
        <div className="hidden sm:block flex-1 max-w-lg sm:mx-6 min-w-0">
          <SearchBar />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Login Button when not logged in */}
          {!user && (
            <button
              onClick={handleLogin}
              className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 bg-white text-black font-bold text-xs rounded-full shadow-md active:scale-95 transition-all"
            >
              <LogIn size={13} />
              <span>Sign in</span>
            </button>
          )}

          {/* Mobile: Hamburger dropdown */}
          <div className="relative sm:hidden" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-all active:scale-95"
              aria-label="Menu"
            >
              <Menu size={18} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-11 w-60 bg-[#1a1a1a] border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User info header or Log in button */}
                {user ? (
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center shrink-0">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-white">{initial}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 border-b border-white/10 bg-white/5">
                    <button
                      onClick={handleLogin}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white text-black font-bold text-xs rounded-xl shadow hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      <LogIn size={14} />
                      <span>Masuk dengan Google</span>
                    </button>
                  </div>
                )}

                {/* Menu items */}
                <div className="py-1.5 px-1.5 space-y-0.5">
                  <DropdownItem icon={Clock} label="Recently Played" onClick={() => navigate('/history')} />
                  <DropdownItem icon={User} label="Profile" onClick={() => navigate('/profile')} />
                  <DropdownItem icon={BarChart2} label="Stats" onClick={() => navigate('/stats')} />
                  <DropdownItem
                    icon={Download}
                    label="Import Playlist"
                    onClick={() => { setDropdownOpen(false); setImportModalOpen(true) }}
                    highlight
                  />
                  <DropdownItem
                    icon={Smartphone}
                    label="Install App"
                    onClick={() => { setDropdownOpen(false); triggerPWAInstall() }}
                  />
                </div>

                {/* Sign out */}
                {user && (
                  <div className="border-t border-white/10 px-1.5 py-1.5">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop: UserMenu */}
          <div className="hidden sm:block">
            <UserMenu />
          </div>
        </div>
      </header>

      <ImportPlaylistModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </>
  )
}

function DropdownItem({
  icon: Icon,
  label,
  onClick,
  highlight,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        highlight
          ? 'text-[#38bdf8] hover:bg-[#38bdf8]/10'
          : 'text-gray-200 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={16} className={highlight ? 'text-[#38bdf8]' : 'text-gray-400'} />
      {label}
    </button>
  )
}
