'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogIn,
  LogOut,
  User,
  Clock,
  BarChart2,
  MessageSquare,
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
  const router = useRouter()

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
  const name = profile?.displayName ?? user.user_metadata?.full_name ?? user.email

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#131313]/80 hover:bg-[#1f1f1f] border border-white/10 transition-all shadow-md"
        aria-label="User menu"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={name ?? ''}
            className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <User size={14} className="text-white" />
          </div>
        )}
        <span className="text-xs font-semibold text-white max-w-[120px] truncate hidden sm:block">
          {name}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-52 bg-[#141414]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl py-2 overflow-hidden space-y-0.5">
            <button
              onClick={() => {
                router.push('/history')
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Clock size={16} className="text-gray-400" />
              Recently Played
            </button>
            <button
              onClick={() => {
                router.push('/stats')
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <BarChart2 size={16} className="text-gray-400" />
              Stats
            </button>
            <button
              onClick={() => {
                router.push('/profile')
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <User size={16} className="text-gray-400" />
              Profile
            </button>
            <button
              onClick={() => {
                router.push('/chat')
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              <MessageSquare size={16} className="text-gray-400" />
              Chat
            </button>
            <button
              onClick={() => {
                setImportModalOpen(true)
                setOpen(false)
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
            >
              <Download size={16} className="text-blue-400" />
              Import Playlist
            </button>
            <div className="border-t border-white/10 my-1.5" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
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
