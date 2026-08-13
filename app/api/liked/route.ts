import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensureProfile'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { data, error } = await supabase
    .from('liked_tracks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const tracks = (data ?? []).map((row) => {
    if (row.metadata_json && typeof row.metadata_json === 'object') {
      return row.metadata_json
    }
    return {
      id: row.track_id,
      videoId: row.video_id,
      title: row.title,
      artist: { name: row.artist ?? 'Unknown' },
      album: row.album ? { name: row.album } : undefined,
      duration: row.duration,
      thumbnail: row.thumbnail_url,
      thumbnailUrl: row.thumbnail_url,
      source: 'ytmusic',
    }
  })

  return NextResponse.json({ success: true, data: tracks })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  await ensureProfile(supabase, user)

  const body = await request.json()
  const { track } = body

  if (!track?.id) return NextResponse.json({ success: false, error: { code: 'MISSING_TRACK' } }, { status: 400 })

  const artistName = typeof track.artist === 'string'
    ? track.artist
    : (track.artist?.name || 'Unknown Artist')

  const albumName = typeof track.album === 'string'
    ? track.album
    : (track.album?.name || null)

  const { error } = await supabase.from('liked_tracks').upsert({
    user_id: user.id,
    track_id: String(track.id),
    video_id: track.videoId ? String(track.videoId) : String(track.id),
    title: track.title || 'Untitled',
    artist: artistName,
    album: albumName,
    thumbnail_url: track.thumbnail ?? track.thumbnailUrl ?? null,
    duration: track.duration || 0,
    metadata_json: track,
  }, { onConflict: 'user_id,track_id' })

  if (error) {
    console.error('[POST /api/liked DB error]:', error)
    return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
