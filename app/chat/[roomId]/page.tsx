import { Suspense } from 'react'
import { ChatRoomPage } from '@/components/pages/ChatRoomPage'

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading chat…</div>}>
      <ChatRoomPage roomId={roomId} />
    </Suspense>
  )
}
