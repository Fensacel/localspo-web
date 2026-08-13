import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function GET(_req: NextRequest, context: { params: Promise<unknown> }) {
  const { roomId } = (await context.params) as { roomId: string }
  if (!roomId) return NextResponse.json({ success: false, error: { code: 'INVALID', message: 'Missing roomId' } }, { status: 400 })

  const supabase = await createClient()

  const [{ data: room }, { data: messages }] = await Promise.all([
    supabase.from('chat_rooms').select('id, name').eq('id', roomId).single(),
    supabase
      .from('chat_messages')
      .select('id, room_id, user_id, content, created_at, profiles(display_name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(200),
  ])

  return NextResponse.json({ success: true, data: { room, messages: messages ?? [] } })
}

export async function POST(req: NextRequest, context: { params: Promise<unknown> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

  const { roomId } = (await context.params) as { roomId: string }
  const body = await req.json()
  const content = String(body.content ?? '').trim().slice(0, 2000)
  if (!content) return NextResponse.json({ success: false, error: { code: 'INVALID', message: 'Content required' } }, { status: 400 })

  const supabase = await createClient()

  // Auto-join room if not a member
  await supabase
    .from('chat_members')
    .upsert({ room_id: roomId, user_id: session.user.id }, { onConflict: 'room_id,user_id', ignoreDuplicates: true })

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, user_id: session.user.id, content })
    .select()
    .single()

  if (error) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  return NextResponse.json({ success: true, data }, { status: 201 })
}
