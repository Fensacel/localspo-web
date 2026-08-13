'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AuthErrorContent() {
  const params = useSearchParams()
  const error = params.get('error')
  const description = params.get('description')

  const errorMessages: Record<string, string> = {
    no_code: 'No authorization code was returned from Google.',
    exchange_failed: 'Failed to exchange authorization code for session.',
    access_denied: 'Access was denied. Please allow LocalSpo to access your Google account.',
    provider_not_enabled: 'Google login is not enabled. Please contact the administrator.',
  }

  const friendlyMessage =
    errorMessages[error ?? ''] ??
    description ??
    'Something went wrong during sign-in. Please try again.'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-2xl">
        ✕
      </div>
      <h1 className="text-2xl font-bold">Authentication Error</h1>
      <p className="text-gray-400 max-w-sm">{friendlyMessage}</p>

      {description && description !== friendlyMessage && (
        <p className="text-xs text-gray-600 max-w-sm font-mono bg-white/5 px-3 py-2 rounded-lg">
          {description}
        </p>
      )}

      <div className="flex flex-col items-center gap-2 mt-2 text-sm text-gray-500 max-w-md">
        <p className="font-semibold text-gray-300">Setup checklist:</p>
        <ol className="text-left list-decimal list-inside space-y-1">
          <li>Supabase dashboard → Authentication → Providers → Google → Enable</li>
          <li>Add Google OAuth Client ID &amp; Secret</li>
          <li>Supabase dashboard → Authentication → URL Configuration → Add <code className="text-blue-400">http://localhost:3000/api/auth/callback</code> to Redirect URLs</li>
          <li>Google Cloud Console → OAuth 2.0 → Authorized redirect URIs → Add <code className="text-blue-400">https://[project-ref].supabase.co/auth/v1/callback</code></li>
        </ol>
      </div>

      <a
        href="/"
        className="px-4 py-2 bg-blue-600 rounded-full text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Go Home
      </a>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-gray-400">Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  )
}
