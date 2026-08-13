import { SupabaseClient, User } from '@supabase/supabase-js'

export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.display_name ||
    user.email ||
    'User'
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture || null

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      display_name: displayName,
      avatar_url: avatarUrl,
    },
    { onConflict: 'id' }
  )

  if (error) {
    console.warn('[ensureProfile] Error upserting profile:', error.message)
  }
}
