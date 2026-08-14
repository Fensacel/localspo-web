import { NextRequest, NextResponse } from 'next/server'
import { fetchLyrics as fetchLrclib } from '@/lib/lyrics/lrclib'
import { fetchNetEaseLyrics } from '@/lib/lyrics/netease'
import { fetchLyricsOvh } from '@/lib/lyrics/lyricsovh'
import type { Lyrics } from '@/types/lyrics'
import { parseLRC } from '@/lib/lyrics/lrcParser'
import { normalizeString } from '@/lib/matcher'

const ICONIC_HEART_LRC = `[00:00.16]Wow, so cool
[00:02.31]I'ma break it down, break it down, break it down, break it down
[00:05.94]Break it down, break it down, break it down, down, down
[00:09.22]Break it down, break it down, break it down, break it down
[00:12.17]Break it down, break it down, break it, break it down, down
[00:16.62]How you feeling? (Bouncy, bouncy)
[00:19.96]そのパワー (up high)
[00:21.68]キラキラ飛び回る あちこち
[00:24.84]間違ってオッケー really, really
[00:28.80]ふざけ合って近づく
[00:31.86]気づいてなくても
[00:35.17]触れた瞬間 電流みたい
[00:38.32]My burning heart (and it's got a feeling like)
[00:41.48](It's a paradise)
[00:44.27]小さい宇宙 広がってく
[00:47.99](Cosmic in your eyes)
[00:50.71]Are you ready? Ay, wanna fly away
[00:54.30]Come, come as you are
[00:56.63]飛び出そう 弾けるように
[01:00.80]星の下で キミとね
[01:04.66]感じる iconic heart
[01:07.13]Iconic heart (hey, hey, hey, hey)
[01:09.64]熱く感じて (hey, hey, hey, hey)
[01:13.15]きっと分かる (hey, hey, hey, hey)
[01:16.10]How I feel, we are iconic heart (hey, hey)
[01:20.02]I keep it cooler 手繰る controller
[01:23.15]And we go high, gotta measure it with a ruler
[01:26.31]Bright, bright, everything shine, hype, hype (I'ma get mine)
[01:29.64]ああしてこうしたり 予測できない
[01:32.73](It's a paradise)
[01:35.48]暗い夜 でも見える
[01:39.12](Cosmic in your eyes)
[01:42.04]鼓動 boom, boom, ay, wanna fly away
[01:45.42]Come, come as you are
[01:47.94]飛び出そう 弾けるように
[01:51.81]星の下で キミとね
[01:55.85]感じる iconic heart
[01:58.48]Iconic heart (hey, hey, hey, hey)
[02:01.01]熱く感じて (hey, hey, hey, hey)
[02:04.38]きっと分かる (hey, hey, hey, hey)
[02:07.38]How I feel, we are iconic heart (hey, hey)
[02:11.76]感じてみて 今よりもっと
[02:15.44]誰よりもそばで
[02:18.49]I wanna dive in はしゃぐ光
[02:22.04]I want you here tonight
[02:33.51]Come, come as you are
[02:35.99]飛び出そう (yeah, yeah) 弾けるように (yeah, yeah)
[02:39.85]星の下で キミとね（ねぇ）
[02:43.93]感じる iconic heart
[02:46.32]Iconic heart (hey, hey, hey, hey 熱く)
[02:48.94]熱く感じて (hey, hey, hey, hey, ah)
[02:52.39]きっと分かる (hey, hey, hey, hey)
[02:55.25]How I feel, we are- (hey, hey)`

function getLocalLyrics(track: string, artist?: string): Lyrics | null {
  const normTrack = normalizeString(track)
  if (normTrack.includes('iconic heart')) {
    const lines = parseLRC(ICONIC_HEART_LRC)
    const plain = lines.map((l) => l.text).join('\n')
    return {
      trackId: 'local-hearts2hearts-iconic-heart',
      synced: true,
      lines,
      plain,
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const artist = sp.get('artist')?.trim()
  const track = sp.get('track')?.trim()
  const album = sp.get('album')?.trim() || undefined
  const durationStr = sp.get('duration')
  const duration = durationStr ? parseFloat(durationStr) : undefined

  if (!artist || !track) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_PARAMS', message: 'artist and track required.' } },
      { status: 400 }
    )
  }

  try {
    // 1. Check if local matched LRC exists
    const localResult = getLocalLyrics(track, artist)
    if (localResult) {
      return NextResponse.json({ success: true, data: localResult })
    }
    const [netEaseLyrics, lrclibLyrics] = await Promise.allSettled([
      fetchNetEaseLyrics({ artist, track }),
      fetchLrclib({ artist, track, album, duration }),
    ])

    const netEaseResult: Lyrics | null =
      netEaseLyrics.status === 'fulfilled' ? netEaseLyrics.value : null
    const lrclibResult: Lyrics | null =
      lrclibLyrics.status === 'fulfilled' ? lrclibLyrics.value : null

    // Choose best synced lyrics
    // If NetEase has granular synced lines (e.g. phrase-by-phrase for K-Pop / Asian / Pop), prioritize it
    let chosen: Lyrics | null = null

    if (netEaseResult?.synced && netEaseResult.lines.length > 0) {
      if (lrclibResult?.synced && lrclibResult.lines.length > 0) {
        // Compare granularity: NetEase usually splits into individual phrases like Spotify Musixmatch
        if (netEaseResult.lines.length >= lrclibResult.lines.length) {
          chosen = netEaseResult
        } else {
          chosen = lrclibResult
        }
      } else {
        chosen = netEaseResult
      }
    } else if (lrclibResult?.synced && lrclibResult.lines.length > 0) {
      chosen = lrclibResult
    } else if (lrclibResult?.plain) {
      chosen = lrclibResult
    } else if (netEaseResult?.plain) {
      chosen = netEaseResult
    } else {
      // Fallback to Lyrics.ovh for plain text
      chosen = await fetchLyricsOvh({ artist, track })
    }

    if (!chosen) {
      return NextResponse.json(
        { success: false, error: { code: 'LYRICS_NOT_FOUND', message: 'Lyrics not found.' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: chosen })
  } catch (err) {
    console.error('[/api/lyrics]', err)
    return NextResponse.json(
      { success: false, error: { code: 'LYRICS_ERROR', message: 'Failed to fetch lyrics.' } },
      { status: 500 }
    )
  }
}
