'use client'

import { useAuthStore } from '@/store/authStore'
import { useState } from 'react'

export function ProfilePage() {
  const { user, profile } = useAuthStore()
  const [avatarError, setAvatarError] = useState(false)
  const [bannerError, setBannerError] = useState(false)

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 text-gray-400">
        <p>Please sign in to view your profile.</p>
      </div>
    )
  }

  const avatarUrl = profile?.avatarUrl ?? user.user_metadata?.avatar_url
  const displayName = profile?.displayName ?? user.user_metadata?.full_name ?? user.email
  const bannerUrl = profile?.bannerUrl

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Banner */}
      <div className="relative h-40 bg-gradient-to-br from-blue-900 to-purple-900 overflow-hidden">
        {bannerUrl && !bannerError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt="Banner"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setBannerError(true)}
          />
        ) : null}
      </div>

      {/* Profile info */}
      <div className="px-6 pb-6">
        <div className="flex items-end gap-4 -mt-12 mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-[#2a2a2a] border-4 border-[#0a0a0a] shrink-0">
            {avatarUrl && !avatarError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName ?? ''}
                className="object-cover w-full h-full"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center text-3xl">
                {displayName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
          <div className="pb-1">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {profile?.username && (
              <p className="text-gray-400 text-sm">@{profile.username}</p>
            )}
            {user.email && (
              <p className="text-gray-500 text-xs mt-0.5">{user.email}</p>
            )}
          </div>
        </div>

        {profile?.bio && (
          <p className="text-gray-300 mb-4">{profile.bio}</p>
        )}

        <div className="flex gap-4 text-sm text-gray-400">
          {profile?.country && <span>🌍 {profile.country}</span>}
          <span>Member since {new Date(profile?.createdAt ?? user.created_at ?? '').toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}
