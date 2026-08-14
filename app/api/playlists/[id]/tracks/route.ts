import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensureProfile'
import { getKnownTrackOverride } from '@/lib/matcher'
import { isYouTubeVideoId } from '@/lib/queuePreloader'

export async function POST(
  request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { id } = (await context.params) as { id: string }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  await ensureProfile(supabase, user)

  // Verify playlist ownership
  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!playlist) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Playlist not found' } }, { status: 404 })
  }

  const body = await request.json()
  const inputTracks = Array.isArray(body.tracks) ? body.tracks : (body.track ? [body.track] : [])

  if (inputTracks.length === 0) {
    return NextResponse.json({ success: false, error: { code: 'MISSING_TRACK' } }, { status: 400 })
  }

  const rowsToInsert = inputTracks.map((track: any, index: number) => {
    const artistName = typeof track.artist === 'string'
      ? track.artist
      : (track.artist?.name || 'Unknown Artist')

    const albumName = typeof track.album === 'string'
      ? track.album
      : (track.album?.name || null)

    const overrideId = getKnownTrackOverride(track.title, artistName)
    const validVideoId =
      overrideId ||
      (isYouTubeVideoId(track.videoId) ? String(track.videoId) : null) ||
      (isYouTubeVideoId(track.id) ? String(track.id) : null)

    return {
      playlist_id: id,
      track_id: String(track.id || track.videoId || `track_${index}`),
      video_id: validVideoId,
      title: track.title || 'Untitled',
      artist: artistName,
      album: albumName,
      thumbnail_url: track.thumbnail ?? track.thumbnailUrl ?? track.coverUrl ?? null,
      duration: track.duration || Math.round((track.durationMs || 0) / 1000),
      metadata_json: track,
    }
  })

  const { error } = await supabase.from('playlist_tracks').upsert(rowsToInsert, { onConflict: 'playlist_id,track_id' })

  if (error) {
    console.error('[POST /api/playlists/[id]/tracks DB error]:', error)
    return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: rowsToInsert.length })
}
