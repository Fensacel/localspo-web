'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'
import { MessageSquare, Plus } from 'lucide-react'
import { useState } from 'react'

export function ChatListPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [roomName, setRoomName] = useState('')

  const { data: rooms, isLoading, refetch } = useQuery({
    queryKey: ['chatRooms'],
    queryFn: async () => {
      const res = await fetch('/api/chat/rooms')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!user,
  })

  async function handleCreate() {
    if (!roomName.trim()) return
    const res = await fetch('/api/chat/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roomName }),
    })
    const json = await res.json()
    setRoomName('')
    setCreating(false)
    refetch()
    if (json.data?.id) router.push(`/chat/${json.data.id}`)
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Sign in to use chat rooms.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Chat Rooms</h1>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-sm font-medium"
          >
            <Plus size={16} /> New Room
          </button>
        </div>

        {creating && (
          <div className="mb-6 flex gap-2">
            <input
              autoFocus
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Room name…"
              className="flex-1 bg-white/10 rounded-lg px-4 py-2 text-sm outline-none border border-white/20 focus:border-blue-500"
            />
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">
              Create
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 bg-white/10 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        )}

        {isLoading && <p className="text-gray-400 animate-pulse">Loading rooms…</p>}

        <div className="space-y-2">
          {(rooms ?? []).map((room: { id: string; name: string; member_count?: number }) => (
            <button
              key={room.id}
              onClick={() => router.push(`/chat/${room.id}`)}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center">
                <MessageSquare size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="font-medium">{room.name}</p>
                {room.member_count !== undefined && (
                  <p className="text-xs text-gray-400">{room.member_count} members</p>
                )}
              </div>
            </button>
          ))}
          {!isLoading && (rooms ?? []).length === 0 && (
            <p className="text-gray-400">No chat rooms yet. Create one!</p>
          )}
        </div>
      </div>
    </div>
  )
}
