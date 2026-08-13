'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { createBrowserClient } from '@supabase/ssr'
import { Send, Download } from 'lucide-react'
interface Message {
  id: string
  room_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { display_name?: string; avatar_url?: string }
}

interface ChatRoomPageProps {
  roomId: string
}

export function ChatRoomPage({ roomId }: ChatRoomPageProps) {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [roomName, setRoomName] = useState('')

  // Initial load
  const { data: initialData } = useQuery({
    queryKey: ['chatMessages', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`)
      const json = await res.json()
      return json.data ?? { messages: [], room: null }
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (initialData?.messages) setMessages(initialData.messages)
    if (initialData?.room?.name) setRoomName(initialData.room.name)
  }, [initialData])

  // Supabase realtime subscription
  useEffect(() => {
    if (!user) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          // Scroll if near bottom
          const el = bottomRef.current?.parentElement
          if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, user])

  // Scroll on initial load
  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [messages.length === 0])

  async function handleSend() {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      })
      setInput('')
    } finally {
      setSending(false)
    }
  }

  function handleExport() {
    const lines = [
      'LocalSpo Chat Room Export',
      '=========================',
      '',
      `Room: ${roomName}`,
      `Exported: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      '--------------------------------',
      ...messages.map((m) => {
        const time = new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const name = m.profiles?.display_name ?? 'Unknown'
        return `[${time}] ${name}\n${m.content}`
      }),
      '--------------------------------',
      '',
      'End of Chat',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-room-${roomName.replace(/\s+/g, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Sign in to join chat rooms.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h1 className="font-semibold">{roomName || 'Chat Room'}</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          title="Export chat"
        >
          <Download size={15} /> Export
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.user_id === user.id
          const name = msg.profiles?.display_name ?? 'Unknown'
          const avatar = msg.profiles?.avatar_url
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-blue-700 shrink-0 overflow-hidden flex items-center justify-center text-sm">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt={name} className="w-full h-full object-cover" />
                ) : (
                  name[0]?.toUpperCase()
                )}
              </div>
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <p className={`text-xs text-gray-500 mb-1 ${isMe ? 'text-right' : ''}`}>
                  {!isMe && <span className="mr-1">{name}</span>}
                  {time}
                </p>
                <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Send a message…"
          className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm outline-none border border-transparent focus:border-blue-500 transition-colors"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center transition-colors"
          aria-label="Send"
        >
          <Send size={15} className="text-white" />
        </button>
      </div>
    </div>
  )
}
