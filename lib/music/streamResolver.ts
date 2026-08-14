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

  // 3. Fallback: TVHTML5 embedded client (different IP signature, often bypasses blocks)
  const resultTv = await resolveWithTvHtml5(videoId)
  if (resultTv) {
    setCache(videoId, resultTv)
    log('Stream resolved via TVHTML5:', videoId)
    return resultTv
  }

  // 4. Fallback to local python yt_dlp if available in local dev
  const resultYtDlp = await resolveWithLocalYtDlp(videoId)
  if (resultYtDlp) {
    setCache(videoId, resultYtDlp)
    log('Stream resolved via local yt-dlp:', videoId)
    return resultYtDlp
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

    // Prefer audio/mp4 (AAC) — universally supported by all browsers including Safari/iOS.
    // audio/webm (opus) is NOT supported by Safari, causing MEDIA_ERR_SRC_NOT_SUPPORTED.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mp4Formats = audioFormats.filter((f: any) => f.mimeType?.includes('audio/mp4'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webmFormats = audioFormats.filter((f: any) => !f.mimeType?.includes('audio/mp4'))

    // Sort each group by bitrate descending, pick best mp4 first, fall back to webm
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortByBitrate = (arr: any[]) => arr.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
    const best = sortByBitrate(mp4Formats)[0] || sortByBitrate(webmFormats)[0]

    return {
      url: best.url,
      mimeType: best.mimeType?.split(';')[0] || 'audio/mp4',
      quality: best.bitrate ? `${Math.round(best.bitrate / 1000)}kbps` : '128kbps',
    }
  } catch (err) {
    log('ANDROID_VR resolver error:', err)
    return null
  }
}

/**
 * TVHTML5_SIMPLY_EMBEDDED_PLAYER — secondary fallback when ANDROID_VR is blocked.
 * Uses a different client signature that YouTube treats as a TV embed, often
 * bypassing region/bot blocks that hit the Android VR client.
 */
async function resolveWithTvHtml5(videoId: string): Promise<StreamInfo | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1',
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
    if (json.playabilityStatus?.status !== 'OK') {
      log('TVHTML5 playability not OK:', json.playabilityStatus?.status)
      return null
    }

    const adaptiveFormats = json.streamingData?.adaptiveFormats || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioFormats = adaptiveFormats.filter((f: any) =>
      f.mimeType?.startsWith('audio/') && Boolean(f.url)
    )
    if (audioFormats.length === 0) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mp4Formats = audioFormats.filter((f: any) => f.mimeType?.includes('audio/mp4'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webmFormats = audioFormats.filter((f: any) => !f.mimeType?.includes('audio/mp4'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortByBitrate = (arr: any[]) => arr.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
    const best = sortByBitrate(mp4Formats)[0] || sortByBitrate(webmFormats)[0]

    return {
      url: best.url,
      mimeType: best.mimeType?.split(';')[0] || 'audio/mp4',
      quality: best.bitrate ? `${Math.round(best.bitrate / 1000)}kbps` : '128kbps',
    }
  } catch (err) {
    log('TVHTML5 resolver error:', err)
    return null
  }
}

/**
 * Local Node.js environment fallback only (bypassed in Cloudflare Workers / Edge)
 */
async function resolveWithLocalYtDlp(videoId: string): Promise<StreamInfo | null> {
  try {
    const cp = await import('child_process').catch(() => null)
    if (!cp || typeof cp.spawn !== 'function') return null

    return new Promise((resolve) => {
      const url = `https://www.youtube.com/watch?v=${videoId}`
      const proc = cp.spawn(
        'python',
        ['-m', 'yt_dlp', '-f', 'bestaudio', '--no-playlist', '--no-warnings', '-j', '--quiet', url],
        { shell: false }
      )

      let stdout = ''
      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.on('error', () => resolve(null))
      proc.on('close', (code: number) => {
        if (code !== 0) return resolve(null)
        try {
          const lines = stdout.trim().split('\n').filter(Boolean)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const info: any = JSON.parse(lines[lines.length - 1])
          const streamUrl: string | undefined = info?.url
          if (!streamUrl) return resolve(null)

          resolve({
            url: streamUrl,
            mimeType: info?.ext === 'm4a' ? 'audio/mp4' : 'audio/webm',
            quality: info?.abr ? `${info.abr}kbps` : 'best',
          })
        } catch {
          resolve(null)
        }
      })
    })
  } catch {
    return null
  }
}
