'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogIn,
  LogOut,
  User,
  Clock,
  BarChart2,
  ChevronDown,
  Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { ImportPlaylistModal } from '@/components/playlist/ImportPlaylistModal'

export function UserMenu() {
  const { user, profile } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const router = useRouter()

  async function handleLogin() {
    try {
      const supabase = createClient()
      const currentPath = window.location.pathname + window.location.search
      const nextParam = currentPath.startsWith('/auth') ? '/' : currentPath
      const redirectUrl = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextParam)}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      })

      if (error) {
        console.error('[UserMenu] signInWithOAuth error:', error.message)
      }
    } catch (err: unknown) {
      console.error('[UserMenu] Login failed:', err)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setImportModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-full text-xs font-semibold transition-all shrink-0"
        >
          <Download size={14} />
          <span>Import<span className="hidden sm:inline"> Playlist</span></span>
        </button>
        <button
          onClick={handleLogin}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-black hover:bg-gray-200 rounded-full text-xs font-bold transition-all shadow-md shrink-0 whitespace-nowrap"
        >
          <LogIn size={14} />
          <span>Sign in</span>
        </button>
        <ImportPlaylistModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
        />
      </div>
    )
  }

  const avatar = profile?.avatarUrl ?? user.user_metadata?.avatar_url
  const name = profile?.displayName ?? user.user_metadata?.full_name ?? user.email ?? 'User'
  const initial = (name.charAt(0) || 'U').toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-0.5 sm:px-3 sm:py-1.5 rounded-full bg-[#141414]/90 hover:bg-[#222222] border border-white/15 transition-all shadow-md active:scale-95"
        aria-label="User menu"
      >
        {/* User Profile Picture (PP) */}
        <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-sky-400 border border-white/20 flex items-center justify-center shrink-0 shadow">
          {avatar && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-xs font-black text-white">{initial}</span>
          )}
        </div>

        <span className="text-xs font-bold text-white max-w-[120px] truncate hidden sm:block">
          {name}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0 hidden sm:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 sm:top-12 z-50 w-56 bg-[#141414]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl py-2 overflow-hidden space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header with profile name & email */}
            <div className="px-4 py-2 border-b border-white/10 mb-1 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shrink-0">
                {avatar && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-white">{initial}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              </div>
            </div>

            <button
              onClick={() => {
                router.push('/history')
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Clock size={16} className="text-gray-400" />
              Recently Played
            </button>
            <button
              onClick={() => {
                router.push('/stats')
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <BarChart2 size={16} className="text-gray-400" />
              Stats
            </button>
            <button
              onClick={() => {
                router.push('/profile')
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <User size={16} className="text-gray-400" />
              Profile
            </button>
            <button
              onClick={() => {
                setImportModalOpen(true)
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-xs font-medium text-[#38bdf8] hover:bg-[#38bdf8]/10 transition-colors"
            >
              <Download size={16} className="text-[#38bdf8]" />
              Import Playlist
            </button>
            <div className="border-t border-white/10 my-1.5" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </>
      )}

      <ImportPlaylistModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  )
}
