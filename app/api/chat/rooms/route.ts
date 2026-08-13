import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('id, name, created_at, chat_members(count)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  const rooms = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    member_count: r.chat_members?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ success: true, data: rooms })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

  const body = await req.json()
  const name = String(body.name ?? '').trim().slice(0, 100)
  if (!name) return NextResponse.json({ success: false, error: { code: 'INVALID', message: 'Name required' } }, { status: 400 })

  const supabase = await createClient()
  const { data: room, error } = await supabase
    .from('chat_rooms')
    .insert({ name, owner_id: session.user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  await supabase.from('chat_members').insert({ room_id: room.id, user_id: session.user.id })

  return NextResponse.json({ success: true, data: room }, { status: 201 })
}
