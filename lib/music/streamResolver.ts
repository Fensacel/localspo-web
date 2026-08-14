/**
 * Stream Resolver
 * Resolves a YouTube videoId to a playable audio stream URL.
 *
 * Edge & Cloudflare Workers compatible:
 * 1. Fast Public Piped & Invidious & Cobalt HTTP APIs (0 Node.js dependencies, 100% Edge safe)
 * 2. ytdl-core (Node.js environments)
 * 3. yt-dlp / python fallback (local Node.js dev environments only)
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

  // 2. Try fast Edge-compatible Public Piped / Invidious instances FIRST
  const resultEdge = await resolveWithPublicInstances(videoId)
  if (resultEdge) {
    setCache(videoId, resultEdge)
    log('Stream resolved via public edge instance:', videoId)
    return resultEdge
  }

  // 3. Try ytdl-core (Node.js runtime)
  const resultYtdl = await resolveWithYtdl(videoId)
  if (resultYtdl) {
    setCache(videoId, resultYtdl)
    log('Stream resolved via ytdl-core:', videoId)
    return resultYtdl
  }

  // 4. Try local yt-dlp binary (local environment fallback only)
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
 * Edge-compatible HTTP Stream Resolvers (Piped & Invidious APIs)
 * Uses zero native Node modules — 100% compatible with Cloudflare Workers and Vercel Edge.
 */
async function resolveWithPublicInstances(videoId: string): Promise<StreamInfo | null> {
  const endpoints = [
    // Piped APIs (fast, direct audio URLs)
    `https://pipedapi.kavin.rocks/streams/${videoId}`,
    `https://api.piped.privacydev.net/streams/${videoId}`,
    `https://pipedapi.tokhmi.xyz/streams/${videoId}`,
    `https://piped-api.garudalinux.org/streams/${videoId}`,
    // Invidious APIs
    `https://invidious.privacydev.net/api/v1/videos/${videoId}`,
    `https://inv.tux.pizza/api/v1/videos/${videoId}`,
    `https://vid.puffyan.us/api/v1/videos/${videoId}`,
    `https://yt.artemislena.eu/api/v1/videos/${videoId}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3500)
      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      })
      clearTimeout(timeout)

      if (!res.ok) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json()

      // 1. Piped response structure
      if (Array.isArray(data?.audioStreams) && data.audioStreams.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sorted = data.audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
        const best = sorted[0]
        if (best?.url) {
          return {
            url: best.url,
            mimeType: best.mimeType || 'audio/webm',
            quality: best.quality || '128kbps',
          }
        }
      }

      // 2. Invidious response structure
      if (Array.isArray(data?.adaptiveFormats)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audioFormats = data.adaptiveFormats.filter((f: any) =>
          f.type?.startsWith('audio/') && f.url
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
        const best = audioFormats[0]
        if (best?.url) {
          return {
            url: best.url,
            mimeType: best.type?.split(';')[0] || 'audio/webm',
            quality: best.audioQuality || 'best',
          }
        }
      }
    } catch {
      // Try next mirror
    }
  }

  return null
}

async function resolveWithYtdl(videoId: string): Promise<StreamInfo | null> {
  try {
    const ytdl = await import('@distube/ytdl-core').catch(() => null)
    if (!ytdl) return null

    const url = `https://www.youtube.com/watch?v=${videoId}`
    const info = await ytdl.default.getInfo(url)

    const formats = ytdl.default
      .filterFormats(info.formats, 'audioonly')
      .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0))

    const best = formats[0]
    if (!best?.url) return null

    return {
      url: best.url,
      mimeType: best.mimeType ?? 'audio/webm',
      quality: `${best.audioBitrate ?? 0}kbps`,
    }
  } catch (err) {
    log('ytdl-core error:', err)
    return null
  }
}

/**
 * Local Node.js environment fallback only (bypassed in Cloudflare Workers / Edge)
 */
async function resolveWithLocalYtDlp(videoId: string): Promise<StreamInfo | null> {
  // Only attempt if child_process is available
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
