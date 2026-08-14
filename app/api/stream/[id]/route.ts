import { NextRequest, NextResponse } from 'next/server'
import { resolveStream, evictCache } from '@/lib/music/streamResolver'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

  async function tryStream(allowRetry: boolean): Promise<NextResponse> {
    const stream = await resolveStream(videoId)

    if (!stream) {
      return NextResponse.json(
        { success: false, error: { code: 'STREAM_UNAVAILABLE', message: 'Unable to play this track.' } },
        { status: 503 }
      )
    }

    const rangeHeader = req.headers.get('range')

    const upstreamHeaders: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
    }
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader
    }

    let upstream: Response
    try {
      upstream = await fetch(stream.url, { headers: upstreamHeaders })
    } catch (err) {
      console.error('[/api/stream] fetch threw:', err)
      if (allowRetry) {
        evictCache(videoId)
        return tryStream(false)
      }
      return NextResponse.json(
        { success: false, error: { code: 'STREAM_FETCH_FAILED', message: 'Could not fetch audio.' } },
        { status: 502 }
      )
    }

    // YouTube IP-bound URLs return 403 when fetched from a different IP than the resolver.
    // Evict cache and re-resolve once to get a fresh URL.
    if ((upstream.status === 403 || upstream.status === 401) && allowRetry) {
      console.warn('[/api/stream] upstream returned', upstream.status, '— evicting cache and retrying:', videoId)
      evictCache(videoId)
      return tryStream(false)
    }

    if (!upstream.ok && upstream.status !== 206) {
      console.error('[/api/stream] upstream fetch failed:', upstream.status, upstream.statusText)
      return NextResponse.json(
        { success: false, error: { code: 'STREAM_FETCH_FAILED', message: 'Could not fetch audio.' } },
        { status: 502 }
      )
    }

    const contentType = upstream.headers.get('content-type') ?? stream.mimeType ?? 'audio/webm'
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges')

    const responseHeaders: HeadersInit = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
    if (contentLength) responseHeaders['Content-Length'] = contentLength
    if (contentRange) responseHeaders['Content-Range'] = contentRange

    return new NextResponse(upstream.body, {
      status: upstream.status || 200,
      headers: responseHeaders,
    })
  }

  try {
    return await tryStream(true)
  } catch (err) {
    console.error('[/api/stream]', err)
    return NextResponse.json(
      { success: false, error: { code: 'STREAM_ERROR', message: 'Stream resolution failed.' } },
      { status: 500 }
    )
  }
}
