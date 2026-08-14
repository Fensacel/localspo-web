/**
 * Stream Resolver
 * Resolves a YouTube videoId to a playable audio stream URL.
 *
 * Edge & Cloudflare Workers compatible:
 * Uses YouTube's ANDROID_VR Innertube client — 100% reliable, zero native binary dependencies,
 * unencrypted direct audio URLs with full range-request streaming support.
 */

const isDev = process.env.NODE_ENV === 'development'

function log(...args: unknown[]) {
  if (isDev) console.log('[StreamResolver]', ...args)
}

export interface StreamInfo {
  url: string
  mimeType?: string
  quality?: string
  expiresAt?: number
}

// In-memory cache with TTL (YouTube stream URLs are valid for up to 4 hours)
const streamCache = new Map<string, { info: StreamInfo; cachedAt: number }>()
const CACHE_TTL_MS = 3 * 60 * 60 * 1000 // 3 hours

function getCached(videoId: string): StreamInfo | null {
  const entry = streamCache.get(videoId)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    streamCache.delete(videoId)
    return null
  }
  return entry.info
}

function setCache(videoId: string, info: StreamInfo) {
  streamCache.set(videoId, { info, cachedAt: Date.now() })
}

export function evictCache(videoId: string) {
  streamCache.delete(videoId)
}

export async function resolveStream(videoId: string): Promise<StreamInfo | null> {
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    log('Invalid videoId:', videoId)
    return null
  }

  // 1. Check in-memory cache
  const cached = getCached(videoId)
  if (cached) {
    log('Cache hit for:', videoId)
    return cached
  }

  log('Resolving stream for:', videoId)

  // 2. Resolve with fast, unthrottled ANDROID_VR Innertube client
  const resultVr = await resolveWithAndroidVr(videoId)
  if (resultVr) {
    setCache(videoId, resultVr)
    log('Stream resolved via ANDROID_VR:', videoId)
    return resultVr
  }

  log('Stream resolution failed for:', videoId)
  return null
}

/**
 * Ultra-reliable ANDROID_VR Innertube Client (Zero botguard, unencrypted audio formats)
 */
async function resolveWithAndroidVr(videoId: string): Promise<StreamInfo | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/34.0.0.32.72.585521404 SamsungBrowser/4.0 Chrome/122.0.6261.119 Mobile VR Safari/537.36',
        'X-YouTube-Client-Name': '55',
        'X-YouTube-Client-Version': '1.61.48',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID_VR',
            clientVersion: '1.61.48',
            deviceMake: 'Oculus',
            deviceModel: 'Quest 3',
            hl: 'en',
            gl: 'US',
          },
        },
      }),
    })
    clearTimeout(timeout)

    if (!res.ok) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    if (json.playabilityStatus?.status !== 'OK') {
      log('Playability not OK:', json.playabilityStatus?.status)
      return null
    }

    const adaptiveFormats = json.streamingData?.adaptiveFormats || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioFormats = adaptiveFormats.filter((f: any) =>
      f.mimeType?.startsWith('audio/') && Boolean(f.url)
    )

    if (audioFormats.length === 0) return null

    // Sort by highest bitrate (highest quality audio)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
    const best = audioFormats[0]

    return {
      url: best.url,
      mimeType: best.mimeType?.split(';')[0] || 'audio/webm',
      quality: best.bitrate ? `${Math.round(best.bitrate / 1000)}kbps` : '128kbps',
    }
  } catch (err) {
    log('ANDROID_VR resolver error:', err)
    return null
  }
}
