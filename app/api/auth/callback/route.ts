import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/'

  // Supabase redirected back with an OAuth error (e.g. provider not enabled)
  if (errorParam) {
    console.error('[Auth] OAuth error:', errorParam, errorDescription)
    const url = new URL(`${origin}/auth/error`)
    url.searchParams.set('error', errorParam)
    url.searchParams.set('description', errorDescription ?? '')
    return NextResponse.redirect(url.toString())
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
    console.error('[Auth] exchangeCodeForSession error:', error.message)
    const url = new URL(`${origin}/auth/error`)
    url.searchParams.set('error', 'exchange_failed')
    url.searchParams.set('description', error.message)
    return NextResponse.redirect(url.toString())
  }

  const url = new URL(`${origin}/auth/error`)
  url.searchParams.set('error', 'no_code')
  url.searchParams.set('description', 'No authorization code returned from OAuth provider.')
  return NextResponse.redirect(url.toString())
}
