import { NextRequest, NextResponse } from 'next/server'
import { resolveStream, evictCache } from '@/lib/music/streamResolver'

export const dynamic = 'force-dynamic'

// Upstream CDN headers — mimic browser behaviour so YouTube CDN accepts the request
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

    // Capture stream in a non-null local so TypeScript knows it's defined inside tryFetch
    const resolvedStream = stream

    /**
     * Attempt to fetch from YouTube CDN and stream the response.
     * If the CDN URL has expired (403/404), evict cache and retry once with a
     * fresh URL before giving up.
     */
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
        // @ts-expect-error — Node 18+ supports duplex for streaming
        duplex: 'half',
      })

      console.log(`[/api/stream] ${videoId} attempt=${attempt} cdnStatus=${upstream.status}`)

      // CDN returned an error — evict stale cache entry and retry once with fresh URL
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

      // Determine content type — prefer our resolved mimeType over what CDN sends
      // because CDN sometimes sends generic 'audio/webm' even for mp4 containers.
      const cdnContentType = upstream.headers.get('content-type') || ''
      const resolvedMime = resolvedStream.mimeType || 'audio/mp4'
      // Use CDN value if it's more specific (contains codec), otherwise use resolved
      const contentType = cdnContentType.includes('codecs') ? cdnContentType : resolvedMime

      const responseHeaders = new Headers()
      responseHeaders.set('Content-Type', contentType)
      responseHeaders.set('Accept-Ranges', 'bytes')
      responseHeaders.set('Access-Control-Allow-Origin', '*')
      responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate')

      const contentLength = upstream.headers.get('content-length')
      const contentRange = upstream.headers.get('content-range')
      if (contentLength) responseHeaders.set('Content-Length', contentLength)
      if (contentRange) responseHeaders.set('Content-Range', contentRange)

      // ── STREAMING ────────────────────────────────────────────────────────────
      // Pipe the body directly instead of buffering with arrayBuffer().
      // This lets the browser start playing immediately and avoids OOM on
      // large files. It also means the CDN connection is held open only as
      // long as the client is listening.
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      })
    }

    return await tryFetch(stream.url, 1)
  } catch (err) {
    console.error('[/api/stream]', err)
    return NextResponse.json(
      { success: false, error: { code: 'STREAM_ERROR', message: 'Stream resolution failed.' } },
      { status: 500 }
    )
  }
}
