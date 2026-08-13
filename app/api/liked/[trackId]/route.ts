import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { trackId } = (await context.params) as { trackId: string }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const decodedId = decodeURIComponent(trackId)
  const { error } = await supabase
    .from('liked_tracks')
    .delete()
    .eq('user_id', user.id)
    .or(`track_id.eq.${decodedId},video_id.eq.${decodedId}`)

  if (error) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ success: true })
}
