import { resolveStream } from '../lib/music/streamResolver.ts'

async function debugMoon() {
  const videoId = '8cFKPrxrrJM'
  console.log('Testing videoId:', videoId)
  const stream = await resolveStream(videoId)
  console.log('Stream info:', stream)

  if (!stream?.url) {
    console.log('Stream URL is missing!')
    return
  }

  // Now test fetching the stream URL with Range header (like Cloudflare / browser does)
  try {
    const upstream = await fetch(stream.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
        'Range': 'bytes=0-1000',
      }
    })
    console.log('Upstream status:', upstream.status)
    console.log('Upstream headers:', Object.fromEntries(upstream.headers.entries()))
  } catch (err) {
    console.error('Fetch failed:', err)
  }
}

debugMoon()
