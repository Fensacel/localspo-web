'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setProfile, setInitialized, logout } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setInitialized(true)
      if (user) fetchProfile(user.id, supabase)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          logout()
        } else if (session?.user) {
          setUser(session.user)
          fetchProfile(session.user.id, supabase)
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fetchProfile(userId: string, supabase: any) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile({
      id: data.id,
      userId: data.id,
      username: data.username ?? '',
      displayName: data.display_name ?? '',
      email: data.email ?? '',
      avatarUrl: data.avatar_url ?? '',
      bannerUrl: data.banner_url ?? '',
      bio: data.bio ?? '',
      country: data.country ?? '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  }

  return <>{children}</>
}
