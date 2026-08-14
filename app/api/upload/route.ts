import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as 'avatar' | 'banner'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Determine storage path
    const folder = type === 'banner' ? 'banners' : 'avatars'
    const path = `${folder}/${user.id}`

    // Upload using service role (bypasses RLS)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadErr } = await admin.storage
      .from('avatars')
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadErr) {
      return NextResponse.json({ error: `Storage error: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path)
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

    // Update profiles table
    const column = type === 'banner' ? 'banner_url' : 'avatar_url'
    const { error: dbErr } = await admin
      .from('profiles')
      .update({ [column]: publicUrl })
      .eq('user_id', user.id)

    if (dbErr) {
      return NextResponse.json({ error: `DB error: ${dbErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
