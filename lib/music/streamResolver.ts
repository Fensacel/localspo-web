/**
 * YouTube Stream Resolver for LocalSpo Web.
 * Supports direct audio extraction with pure JS fallbacks for Cloudflare Workers & Node.
 */

export interface StreamInfo {
  url: string
  mimeType: string
  quality: string
  bitrate?: number
}

const isDev = process.env.NODE_ENV === 'development'

function log(...args: unknown[]) {
  if (isDev) console.log('[StreamResolver]', ...args)
}

// In-memory cache for resolved stream URLs (TTL: 3 hours)
const cache = new Map<string, { stream: StreamInfo; expiresAt: number }>()

function getCached(videoId: string): StreamInfo | null {
  const entry = cache.get(videoId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(videoId)
    return null
  }
  return entry.stream
}

function setCache(videoId: string, stream: StreamInfo) {
  cache.set(videoId, {
    stream,
    expiresAt: Date.now() + 3 * 60 * 60 * 1000,
  })
}

export function evictCache(videoId: string) {
  cache.delete(videoId)
}

/**
 * Resolves YouTube videoId to a direct audio stream URL.
 */
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

  // 2. Node / Local environment fast extractor (yt-dlp -g)
  const directResult = await resolveWithLocalExtractor(videoId)
  if (directResult) {
    setCache(videoId, directResult)
    log('Stream resolved via local extractor:', videoId)
    return directResult
  }

  // 3. Cloudflare Workers / Pure JS Innertube Client (ANDROID_VR)
  const resultVr = await resolveWithAndroidVr(videoId)
  if (resultVr) {
    setCache(videoId, resultVr)
    log('Stream resolved via ANDROID_VR:', videoId)
    return resultVr
  }

  // 4. Fallback pure JS Innertube Client (TVHTML5)
  const resultTv = await resolveWithTvHtml5(videoId)
  if (resultTv) {
    setCache(videoId, resultTv)
    log('Stream resolved via TVHTML5:', videoId)
    return resultTv
  }

  log('Stream resolution failed for:', videoId)
  return null
}

/**
 * Fast direct URL resolver using local yt-dlp binary (if running in Node environment)
 */
async function resolveWithLocalExtractor(videoId: string): Promise<StreamInfo | null> {
  try {
    // Dynamic import to prevent bundler errors on Cloudflare Workers
    const cp = await import('child_process').catch(() => null)
    if (!cp || !cp.exec) return null

    return new Promise((resolve) => {
      const cmd = `python -m yt_dlp -g -f "140/bestaudio[ext=m4a]/251/bestaudio" "https://www.youtube.com/watch?v=${videoId}"`
      cp.exec(cmd, { timeout: 8000 }, (err, stdout) => {
        if (err || !stdout) {
          resolve(null)
          return
        }
        const url = stdout.trim().split('\n')[0]?.trim()
        if (url && url.startsWith('http')) {
          const isM4a = url.includes('audio%2Fmp4') || url.includes('itag=140')
          resolve({
            url,
            mimeType: isM4a ? 'audio/mp4' : 'audio/webm',
            quality: '128kbps',
          })
        } else {
          resolve(null)
        }
      })
    })
  } catch {
    return null
  }
}

/**
 * ANDROID_VR Innertube Client (Pure JS HTTP fetch for Cloudflare Workers)
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
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/34.0.0.32.72.585521404 SamsungBrowser/4.0 Chrome/122.0.6261.119 Mobile VR Safari/537.36',
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
    if (json.playabilityStatus?.status !== 'OK') return null

    const adaptiveFormats = json.streamingData?.adaptiveFormats || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioFormats = adaptiveFormats.filter((f: any) =>
      f.mimeType?.startsWith('audio/') && Boolean(f.url)
    )

    if (audioFormats.length === 0) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
    const best = audioFormats[0]

    return {
      url: best.url,
      mimeType: best.mimeType || 'audio/webm',
      quality: best.bitrate ? `${Math.round(best.bitrate / 1000)}kbps` : '128kbps',
      bitrate: best.bitrate,
    }
  } catch (err) {
    log('ANDROID_VR resolver error:', err)
    return null
  }
}

/**
 * TVHTML5 embedded client (Pure JS HTTP fetch for Cloudflare Workers)
 */
async function resolveWithTvHtml5(videoId: string): Promise<StreamInfo | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1',
        'X-YouTube-Client-Name': '85',
        'X-YouTube-Client-Version': '2.0',
        'Origin': 'https://www.youtube.com',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
            clientVersion: '2.0',
            hl: 'en',
            gl: 'US',
          },
          thirdParty: {
            embedUrl: 'https://www.youtube.com/',
          },
        },
      }),
    })
    clearTimeout(timeout)

    if (!res.ok) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    if (json.playabilityStatus?.status !== 'OK') return null

    const adaptiveFormats = json.streamingData?.adaptiveFormats || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioFormats = adaptiveFormats.filter((f: any) =>
      f.mimeType?.startsWith('audio/') && Boolean(f.url)
    )
    if (audioFormats.length === 0) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
    const best = audioFormats[0]

    return {
      url: best.url,
      mimeType: best.mimeType || 'audio/webm',
      quality: best.bitrate ? `${Math.round(best.bitrate / 1000)}kbps` : '128kbps',
      bitrate: best.bitrate,
    }
  } catch (err) {
    log('TVHTML5 resolver error:', err)
    return null
  }
}
