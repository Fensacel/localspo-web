/**
 * Stream Resolver
 * Resolves a YouTube videoId to a temporary playable audio URL.
 *
 * Uses ytdl-core → yt-dlp-wrap → python -m yt_dlp as fallback chain.
 * Stream URLs expire — never store them permanently.
 */

import { spawn } from 'child_process'

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

// In-memory cache with TTL (YouTube stream URLs are valid for up to 6 hours)
const streamCache = new Map<string, { info: StreamInfo; cachedAt: number }>()
const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

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

  // Check cache first
  const cached = getCached(videoId)
  if (cached) {
    log('Cache hit for:', videoId)
    return cached
  }

  log('Resolving stream for:', videoId)

  // Try ytdl-core
  const result = await resolveWithYtdl(videoId)
  if (result) {
    setCache(videoId, result)
    log('Stream resolved via ytdl-core:', videoId)
    return result
  }

  // Try yt-dlp-wrap with custom binary path
  const result2 = await resolveWithYtDlpWrap(videoId)
  if (result2) {
    setCache(videoId, result2)
    log('Stream resolved via yt-dlp-wrap:', videoId)
    return result2
  }

  // Try python -m yt_dlp (fallback for when yt-dlp binary not in PATH)
  const result3 = await resolveWithPythonYtDlp(videoId)
  if (result3) {
    setCache(videoId, result3)
    log('Stream resolved via python -m yt_dlp:', videoId)
    return result3
  }

  log('Stream resolution failed for:', videoId)
  return null
}

async function resolveWithYtdl(videoId: string): Promise<StreamInfo | null> {
  try {
    const ytdl = await import('@distube/ytdl-core').catch(() => null)
    if (!ytdl) return null

    const url = `https://www.youtube.com/watch?v=${videoId}`
    const info = await ytdl.default.getInfo(url)

    // Filter for audio-only formats, prefer highest quality
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

async function resolveWithYtDlpWrap(videoId: string): Promise<StreamInfo | null> {
  try {
    const YTDlpWrap = await import('yt-dlp-wrap').catch(() => null)
    if (!YTDlpWrap) return null

    // Try to find yt-dlp binary in common locations
    const possibleBinaries = [
      'yt-dlp',
      'yt-dlp.exe',
      `${process.env.LOCALAPPDATA}\\Programs\\yt-dlp\\yt-dlp.exe`,
      `${process.env.USERPROFILE}\\.local\\bin\\yt-dlp`,
    ].filter(Boolean)

    let ytDlp: InstanceType<typeof YTDlpWrap.default> | null = null
    for (const bin of possibleBinaries) {
      try {
        const instance = new YTDlpWrap.default(bin)
        // Quick test
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(bin!, ['--version'], { shell: false })
          proc.on('close', (code) => (code === 0 ? resolve() : reject()))
          proc.on('error', reject)
        })
        ytDlp = instance
        break
      } catch {
        // try next
      }
    }

    if (!ytDlp) return null

    const url = `https://www.youtube.com/watch?v=${videoId}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: any = await ytDlp.getVideoInfo([
      url,
      '-f',
      'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
      '--no-playlist',
    ])

    const streamUrl: string = info?.url ?? info?.formats?.[0]?.url
    if (!streamUrl) return null

    return {
      url: streamUrl,
      mimeType: 'audio/webm',
      quality: 'best',
    }
  } catch (err) {
    log('yt-dlp-wrap error:', err)
    return null
  }
}

/**
 * Fallback: use `python -m yt_dlp` when yt-dlp binary is not in PATH
 * but yt-dlp is installed as a Python package.
 */
function resolveWithPythonYtDlp(videoId: string): Promise<StreamInfo | null> {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`
    const args = [
      '-m', 'yt_dlp',
      '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
      '--no-playlist',
      '--no-warnings',
      '-j',          // print JSON to stdout
      '--quiet',
      url,
    ]

    log('Spawning: python', args.join(' '))

    // Try 'python' first, then 'python3'
    const pythonBin = 'python'
    const proc = spawn(pythonBin, args, { shell: false })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on('error', (err) => {
      log('python -m yt_dlp spawn error:', err)
      resolve(null)
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        log('python -m yt_dlp exited with code', code, stderr.slice(0, 200))
        resolve(null)
        return
      }

      try {
        // stdout is newline-delimited JSON; last non-empty line is the main entry
        const lines = stdout.trim().split('\n').filter(Boolean)
        const lastLine = lines[lines.length - 1]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const info: any = JSON.parse(lastLine)

        // url is at info.url for the selected format, or pick best from formats
        let streamUrl: string | undefined = info?.url

        if (!streamUrl && Array.isArray(info?.formats)) {
          // Find best audio-only format
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const audioFormats = info.formats.filter((f: any) =>
            f.vcodec === 'none' && f.url
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          audioFormats.sort((a: any, b: any) => (b.abr ?? 0) - (a.abr ?? 0))
          streamUrl = audioFormats[0]?.url
        }

        if (!streamUrl) {
          log('python -m yt_dlp: no stream URL in output')
          resolve(null)
          return
        }

        resolve({
          url: streamUrl,
          mimeType: info?.ext === 'm4a' ? 'audio/mp4' : 'audio/webm',
          quality: info?.abr ? `${info.abr}kbps` : 'best',
        })
      } catch (parseErr) {
        log('python -m yt_dlp JSON parse error:', parseErr)
        resolve(null)
      }
    })
  })
}
