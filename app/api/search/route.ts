import { NextRequest, NextResponse } from 'next/server'
import { searchYTMusic } from '@/lib/music/ytmusic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()

  if (!q || q.length < 1) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_QUERY', message: 'Query required.' } },
      { status: 400 }
    )
  }

  if (q.length > 200) {
    return NextResponse.json(
      { success: false, error: { code: 'QUERY_TOO_LONG', message: 'Query too long.' } },
      { status: 400 }
    )
  }

  try {
    const data = await searchYTMusic(q)
    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
          'CDN-Cache-Control': 'max-age=86400',
        },
      }
    )
  } catch (err) {
    console.error('[/api/search]', err)
    return NextResponse.json(
      { success: false, error: { code: 'SEARCH_FAILED', message: 'Search failed.' } },
      { status: 500 }
    )
  }
}
