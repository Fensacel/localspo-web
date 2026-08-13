import { NextRequest, NextResponse } from 'next/server'
import { getAlbum } from '@/lib/music/ytmusic'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { id } = (await context.params) as { id: string }

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_ID', message: 'Album ID required.' } },
      { status: 400 }
    )
  }

  try {
    const album = await getAlbum(id)
    if (!album) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Album not found.' } },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: album })
  } catch (err) {
    console.error('[/api/albums]', err)
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch album.' } },
      { status: 500 }
    )
  }
}
