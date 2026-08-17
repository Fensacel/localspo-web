import { NextRequest, NextResponse } from 'next/server'
import { resolveStream, evictCache } from '@/lib/music/streamResolver'

export const dynamic = 'force-dynamic'

const UPSTREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

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

    async function tryFetch(url: string, attempt: number): Promise<Response> {
      const upstreamHeaders: Record<string, string> = {
        'User-Agent': UPSTREAM_UA,
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
      }
      if (range) upstreamHeaders['Range'] = range

      const upstream = await fetch(url, {
        headers: upstreamHeaders,
      })

      if (!upstream.ok && upstream.status !== 206) {
        evictCache(videoId)

        if (attempt === 1) {
          const fresh = await resolveStream(videoId)
          if (fresh?.url && fresh.url !== url) {
            return tryFetch(fresh.url, 2)
          }
        }

        return NextResponse.json(
          { success: false, error: { code: 'STREAM_FETCH_FAILED', message: `CDN error: ${upstream.status}` } },
          { status: 502 }
        )
      }

      const cdnContentType = upstream.headers.get('content-type') || ''
      const contentType = cdnContentType.includes('audio/')
        ? cdnContentType
        : stream?.mimeType || 'audio/webm'

      const responseHeaders = new Headers()
      responseHeaders.set('Content-Type', contentType)
      responseHeaders.set('Accept-Ranges', 'bytes')
      responseHeaders.set('Access-Control-Allow-Origin', '*')
      responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate')

      const contentLength = upstream.headers.get('content-length')
      const contentRange = upstream.headers.get('content-range')
      if (contentLength) responseHeaders.set('Content-Length', contentLength)
      if (contentRange) responseHeaders.set('Content-Range', contentRange)

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      })
    }

    return await tryFetch(stream.url, 1)
  } catch (err) {
    console.error('[/api/stream] Error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'STREAM_ERROR', message: 'Stream resolution failed.' } },
      { status: 500 }
    )
  }
}
