import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensureProfile'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const rawNext = searchParams.get('next') ?? '/'

  // Resolve current effective origin dynamically without hardcoding
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')

  let effectiveOrigin = origin
  if (forwardedHost) {
    const proto = forwardedProto || 'https'
    effectiveOrigin = `${proto}://${forwardedHost}`
  }

  // Prevent open redirect vulnerabilities: ensure next is a relative path
  let safeNext = '/'
  if (rawNext.startsWith('/') && !rawNext.startsWith('//')) {
    safeNext = rawNext
  }

  // Handle provider-level OAuth errors (e.g. user cancelled or access denied)
  if (errorParam) {
    console.warn('[Auth Callback] OAuth provider returned error:', errorParam, errorDescription)
    // If the user simply cancelled the Google login prompt, redirect back to home cleanly
    if (errorParam === 'access_denied') {
      const errorUrl = new URL(`${effectiveOrigin}/auth/error`)
      errorUrl.searchParams.set('error', 'access_denied')
      if (errorDescription) errorUrl.searchParams.set('description', errorDescription)
      return NextResponse.redirect(errorUrl.toString())
    }

    const errorUrl = new URL(`${effectiveOrigin}/auth/error`)
    errorUrl.searchParams.set('error', errorParam)
    if (errorDescription) errorUrl.searchParams.set('description', errorDescription)
    return NextResponse.redirect(errorUrl.toString())
  }

  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error && data?.user) {
        // Ensure user profile record exists in Supabase DB
        try {
          await ensureProfile(supabase, data.user)
        } catch (profileErr) {
          console.warn('[Auth Callback] Profile upsert warning:', profileErr)
        }

        return NextResponse.redirect(`${effectiveOrigin}${safeNext}`)
      }

      if (error) {
        console.error('[Auth Callback] exchangeCodeForSession error:', error.message)
        const errorUrl = new URL(`${effectiveOrigin}/auth/error`)
        errorUrl.searchParams.set('error', 'exchange_failed')
        errorUrl.searchParams.set('description', error.message)
        return NextResponse.redirect(errorUrl.toString())
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown authentication error'
      console.error('[Auth Callback] Unexpected error during code exchange:', message)
      const errorUrl = new URL(`${effectiveOrigin}/auth/error`)
      errorUrl.searchParams.set('error', 'exchange_failed')
      errorUrl.searchParams.set('description', message)
      return NextResponse.redirect(errorUrl.toString())
    }
  }

  // No code and no error param present
  const errorUrl = new URL(`${effectiveOrigin}/auth/error`)
  errorUrl.searchParams.set('error', 'no_code')
  errorUrl.searchParams.set('description', 'No authorization code returned from OAuth provider.')
  return NextResponse.redirect(errorUrl.toString())
}
