import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensureProfile'

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: true, data: [] })

    const { data, error } = await supabase
      .from('playlists')
      .select('*, playlist_tracks(count)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[/api/playlists GET] DB error:', error.message)
      return NextResponse.json({ success: true, data: [] })
    }

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.warn('[/api/playlists GET] Unexpected error:', err)
    return NextResponse.json({ success: true, data: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

    await ensureProfile(supabase, user)

    const body = await request.json()
    const { title, description, coverUrl, type = 'cloud' } = body

    if (!title?.trim()) return NextResponse.json({ success: false, error: { code: 'MISSING_TITLE' } }, { status: 400 })

    const { data, error } = await supabase.from('playlists').insert({
      owner_id: user.id,
      title: title.trim(),
      description: description?.trim(),
      cover_url: coverUrl,
      type,
    }).select().single()

    if (error) {
      console.warn('[/api/playlists POST] DB error:', error.message)
      return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[/api/playlists POST] Error:', err)
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 })
  }
}
