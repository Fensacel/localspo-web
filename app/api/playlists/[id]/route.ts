import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { id } = (await context.params) as { id: string }
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('playlists')
    .select('*, playlist_tracks(*)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 })

  const tracks = (data.playlist_tracks || []).map((pt: any) => ({
    id: pt.track_id,
    videoId: pt.video_id,
    title: pt.title,
    artist: { name: pt.artist },
    album: pt.album ? { name: pt.album } : undefined,
    thumbnail: pt.thumbnail_url,
    thumbnailUrl: pt.thumbnail_url,
    duration: pt.duration,
    source: 'spotify',
  }))

  return NextResponse.json({
    success: true,
    data: {
      ...data,
      coverUrl: data.cover_url,
      tracks,
    },
  })
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { id } = (await context.params) as { id: string }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const body = await request.json()
  const { title, description, coverUrl } = body

  const { error } = await supabase
    .from('playlists')
    .update({ title, description, cover_url: coverUrl, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { id } = (await context.params) as { id: string }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ success: true })
}
