export interface ChatRoom {
  id: string
  name: string
  description?: string
  createdBy: string
  createdAt: string
  memberCount?: number
}

export interface ChatMessage {
  id: string
  roomId: string
  userId: string
  content: string
  createdAt: string
  user: {
    name: string
    avatarUrl?: string
  }
}

export interface ChatMember {
  id: string
  roomId: string
  userId: string
  joinedAt: string
  user?: {
    name: string
    avatarUrl?: string
  }
}
