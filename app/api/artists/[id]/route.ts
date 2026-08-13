import { NextRequest, NextResponse } from 'next/server'
import { getArtist } from '@/lib/music/ytmusic'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { id } = (await context.params) as { id: string }

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_ID', message: 'Artist ID required.' } },
      { status: 400 }
    )
  }

  try {
    const artist = await getArtist(id)
    if (!artist) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Artist not found.' } },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: artist })
  } catch (err) {
    console.error('[/api/artists]', err)
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch artist.' } },
      { status: 500 }
    )
  }
}
