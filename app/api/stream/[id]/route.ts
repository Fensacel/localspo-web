import { NextRequest, NextResponse } from 'next/server'
import { resolveStream, evictCache } from '@/lib/music/streamResolver'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { id: videoId } = (await context.params) as { id: string }

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_VIDEO_ID', message: 'Invalid video ID.' } },
      { status: 400 }
    )
  }

  try {
    const stream = await resolveStream(videoId)

    if (!stream || !stream.url) {
      return NextResponse.json(
        { success: false, error: { code: 'STREAM_UNAVAILABLE', message: 'Unable to play this track.' } },
        { status: 404 }
      )
    }

    // Redirect audio player directly to the high-speed unencrypted stream
    return NextResponse.redirect(stream.url, {
      status: 307,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[/api/stream]', err)
    return NextResponse.json(
      { success: false, error: { code: 'STREAM_ERROR', message: 'Stream resolution failed.' } },
      { status: 500 }
    )
  }
}
