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

    const range = req.headers.get('range')
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
    }
    if (range) {
      upstreamHeaders['Range'] = range
    }

    const upstream = await fetch(stream.url, { headers: upstreamHeaders })

    if (!upstream.ok && upstream.status !== 206) {
      if (upstream.status === 403) {
        evictCache(videoId)
      }
      return NextResponse.json(
        { success: false, error: { code: 'STREAM_FETCH_FAILED', message: 'Could not fetch stream.' } },
        { status: 502 }
      )
    }

    const headers = new Headers()
    const contentType = upstream.headers.get('content-type') || stream.mimeType || 'audio/webm'
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')

    headers.set('Content-Type', contentType)
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    if (contentLength) headers.set('Content-Length', contentLength)
    if (contentRange) headers.set('Content-Range', contentRange)

    const arrayBuffer = await upstream.arrayBuffer()

    return new Response(arrayBuffer, {
      status: upstream.status || 200,
      headers,
    })
  } catch (err) {
    console.error('[/api/stream]', err)
    return NextResponse.json(
      { success: false, error: { code: 'STREAM_ERROR', message: 'Stream resolution failed.' } },
      { status: 500 }
    )
  }
}
