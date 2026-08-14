import { NextResponse } from 'next/server'
import { searchYTMusic } from '@/lib/music/ytmusic'
import { scoreTrackMatch, getKnownTrackOverride, type SpotifyTrackInput, type MatchResult } from '@/lib/matcher'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tracks: SpotifyTrackInput[] = body.tracks

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'An array of tracks is required.' },
        },
        { status: 400 }
      )
    }

    // Process up to 50 tracks
    const targetTracks = tracks.slice(0, 50)
    const results: MatchResult[] = []

    // Concurrency limit of 5 parallel requests
    const chunkSize = 5
    for (let i = 0; i < targetTracks.length; i += chunkSize) {
      const chunk = targetTracks.slice(i, i + chunkSize)
      const chunkPromises = chunk.map(async (spotifyTrack) => {
        const overrideId = getKnownTrackOverride(spotifyTrack.title, spotifyTrack.artist)
        if (overrideId) {
          return {
            spotifyTrack,
            matchedTrack: {
              id: overrideId,
              videoId: overrideId,
              title: spotifyTrack.title,
              artist: { name: spotifyTrack.artist },
              album: spotifyTrack.album ? { name: spotifyTrack.album } : undefined,
              thumbnail: spotifyTrack.coverUrl,
              thumbnailUrl: spotifyTrack.coverUrl,
              duration: spotifyTrack.durationMs ? Math.round(spotifyTrack.durationMs / 1000) : 0,
              source: 'ytmusic' as const,
            },
            status: 'matched' as const,
            score: 1.0,
          }
        }

        const query = `${spotifyTrack.title} ${spotifyTrack.artist}`
        try {
          const searchRes = await searchYTMusic(query)
          const candidateSongs = searchRes.songs || []
          const topResult = searchRes.topResult?.data ? [searchRes.topResult.data] : []
          const allCandidates = [...topResult, ...candidateSongs]

          let bestMatch: any = null
          let bestScore = 0

          for (const candidate of allCandidates) {
            const { isMatch, score } = scoreTrackMatch(spotifyTrack, candidate, 0.40)
            if (isMatch && score > bestScore) {
              bestScore = score
              bestMatch = candidate
            }
          }

          // Fallback search with "audio" keyword if not matched
          if (!bestMatch) {
            try {
              const fbRes = await searchYTMusic(`${spotifyTrack.title} ${spotifyTrack.artist} audio`)
              const fbCandidates = [
                ...(fbRes.topResult?.data ? [fbRes.topResult.data] : []),
                ...(fbRes.songs || []),
              ]
              for (const candidate of fbCandidates) {
                const { isMatch, score } = scoreTrackMatch(spotifyTrack, candidate, 0.40)
                if (isMatch && score > bestScore) {
                  bestScore = score
                  bestMatch = candidate
                }
              }
            } catch {}
          }

          if (bestMatch && bestScore >= 0.35) {
            return {
              spotifyTrack,
              matchedTrack: bestMatch,
              status: 'matched' as const,
              score: bestScore,
            }
          } else {
            return {
              spotifyTrack,
              matchedTrack: null,
              status: 'not_found' as const,
              score: 0,
            }
          }
        } catch {
          return {
            spotifyTrack,
            matchedTrack: null,
            status: 'not_found' as const,
            score: 0,
          }
        }
      })

      const chunkResults = await Promise.all(chunkPromises)
      results.push(...chunkResults)
    }

    const matchedTracks = results
      .filter((r) => r.status === 'matched' && r.matchedTrack)
      .map((r) => r.matchedTrack)

    return NextResponse.json({
      success: true,
      data: matchedTracks,
      results,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'MATCH_ERROR', message: err?.message || 'Failed to match tracks.' },
      },
      { status: 500 }
    )
  }
}
