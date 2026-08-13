import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensureProfile'

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: true, data: [] })

    const { data, error } = await supabase
      .from('play_history')
      .select('*')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(100)

    if (error) {
      console.warn('[/api/history] DB error (table may not exist):', error.message)
      return NextResponse.json({ success: true, data: [] })
    }

    const entries = (data ?? []).map((row) => {
      const baseTrack = (row.metadata_json && typeof row.metadata_json === 'object') ? row.metadata_json : {}
      const artistName = typeof baseTrack.artist === 'string'
        ? baseTrack.artist
        : baseTrack.artist?.name || row.artist || 'Unknown'
      const albumName = baseTrack.album?.name || row.album || ''

      return {
        ...baseTrack,
        id: baseTrack.id || row.track_id,
        videoId: baseTrack.videoId || row.video_id,
        title: baseTrack.title || row.title || 'Unknown Track',
        artist: { name: artistName },
        album: albumName ? { name: albumName } : undefined,
        duration: row.duration || baseTrack.duration || 0,
        thumbnail: baseTrack.thumbnail || baseTrack.thumbnailUrl || row.thumbnail_url,
        thumbnailUrl: baseTrack.thumbnailUrl || baseTrack.thumbnail || row.thumbnail_url,
        source: 'ytmusic',
        // history specific fields
        track_id: row.track_id,
        played_at: row.played_at,
        progress: row.progress || 0,
      }
    })

    return NextResponse.json({ success: true, data: entries })
  } catch (err) {
    console.warn('[/api/history] unexpected error:', err)
    return NextResponse.json({ success: true, data: [] })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  let { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data } = await supabase.auth.getUser(token)
      user = data.user
    }
  }

  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  await ensureProfile(supabase, user)

  const body = await request.json()
  const { track, progress, duration } = body

  if (!track?.id) return NextResponse.json({ success: false, error: { code: 'MISSING_TRACK' } }, { status: 400 })

  // Record plays when progress is at least 3 seconds (or > 10s per req)
  if (progress < 3) return NextResponse.json({ success: true, skipped: true })

  const artistName = typeof track.artist === 'string' ? track.artist : track.artist?.name
  const albumName = track.album?.name

  const { error } = await supabase.from('play_history').insert({
    user_id: user.id,
    track_id: track.id,
    video_id: track.videoId,
    title: track.title,
    artist: artistName,
    album: albumName,
    thumbnail_url: track.thumbnail ?? track.thumbnailUrl,
    duration: duration ?? track.duration ?? 0,
    progress,
    played_at: new Date().toISOString(),
    metadata_json: track,
  })

  if (error) {
    console.warn('[/api/history POST] DB error (table may not exist):', error.message)
    return NextResponse.json({ success: true, skipped: true })
  }

  return NextResponse.json({ success: true })
}
