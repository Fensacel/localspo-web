'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function AuthErrorContent() {
  const params = useSearchParams()
  const router = useRouter()
  const error = params.get('error')
  const description = params.get('description')
  const [currentOrigin, setCurrentOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin)
    }
  }, [])

  const errorMessages: Record<string, string> = {
    no_code: 'No authorization code was returned from Google.',
    exchange_failed: 'Failed to exchange authorization code for session.',
    access_denied: 'Sign-in was cancelled or access was denied.',
    provider_not_enabled: 'Google login is not enabled in Supabase. Please contact the administrator.',
  }

  const isPkceError = description?.toLowerCase().includes('pkce')

  const friendlyMessage =
    errorMessages[error ?? ''] ??
    (isPkceError
      ? 'The login session timed out or browser storage was cleared during sign-in.'
      : description ?? 'Something went wrong during sign-in. Please try again.')

  async function handleRetry() {
    try {
      const supabase = createClient()
      const redirectUrl = `${window.location.origin}/api/auth/callback`
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      })
    } catch (err) {
      console.error('[AuthError] Retry failed:', err)
      router.push('/')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
        <AlertTriangle size={28} />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Authentication Error</h1>
        <p className="text-sm text-gray-400 max-w-md">{friendlyMessage}</p>
      </div>

      {description && description !== friendlyMessage && (
        <p className="text-xs text-red-300/80 max-w-md font-mono bg-red-950/30 border border-red-800/30 px-3 py-2 rounded-lg break-all text-left">
          {description}
        </p>
      )}

      {isPkceError && (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 max-w-md text-left text-xs text-amber-200/90 space-y-1.5">
          <p className="font-semibold text-amber-300">Why did this happen?</p>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>Browser data / cookies were cleared during the OAuth redirect.</li>
            <li>
              The callback URL (<code>{currentOrigin || 'your current URL'}/api/auth/callback</code>) might not be in Supabase&apos;s Allowed Redirect URLs, causing a redirect to the default Site URL.
            </li>
          </ul>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 mt-1 text-xs text-gray-400 max-w-md bg-white/5 border border-white/10 p-4 rounded-xl">
        <p className="font-semibold text-gray-200">Supabase &amp; Google Cloud Checklist:</p>
        <ol className="text-left list-decimal list-inside space-y-1.5 text-gray-400">
          <li>
            Supabase Dashboard &rarr; <span className="text-gray-200">Authentication &rarr; Providers &rarr; Google</span> (Enabled).
          </li>
          <li>
            Supabase Dashboard &rarr; <span className="text-gray-200">URL Configuration &rarr; Redirect URLs</span>:
            <div className="pl-4 mt-0.5 space-y-0.5 font-mono text-[11px] text-sky-400 break-all">
              <div>{currentOrigin ? `${currentOrigin}/api/auth/callback` : 'http://localhost:3000/api/auth/callback'}</div>
            </div>
          </li>
          <li>
            Google Cloud Console &rarr; <span className="text-gray-200">Authorized redirect URIs</span>:
            <div className="pl-4 mt-0.5 font-mono text-[11px] text-sky-400 break-all">
              https://[project-ref].supabase.co/auth/v1/callback
            </div>
          </li>
        </ol>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold transition-all shadow-lg active:scale-95"
        >
          <RefreshCw size={14} />
          <span>Try Signing In Again</span>
        </button>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-gray-200 rounded-full text-xs font-medium transition-all"
        >
          <ArrowLeft size={14} />
          <span>Go Home</span>
        </button>
      </div>
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
