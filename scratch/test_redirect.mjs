import { resolveStream } from '../lib/music/streamResolver.ts'

async function testRedirect() {
  const videoId = '8cFKPrxrrJM'
  const stream = await resolveStream(videoId)
  console.log('Stream URL:', stream?.url?.substring(0, 80))

  if (!stream?.url) return

  // Test if browser audio fetch following redirect gets 206 from googlevideo
  const res = await fetch(stream.url, {
    headers: {
      'Range': 'bytes=0-1000',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    }
  })

  console.log('Direct status:', res.status)
  console.log('Content-Type:', res.headers.get('content-type'))
  console.log('Content-Range:', res.headers.get('content-range'))
  console.log('CORP:', res.headers.get('cross-origin-resource-policy'))
}

testRedirect()
