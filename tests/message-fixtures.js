export const message = (id, extra = {}) => ({
  id,
  conversation_id: 12,
  sender: { id: 8, username: 'alex', avatar: null },
  content: `Message ${id}`,
  created_at: '2026-11-03T10:00:00',
  read_at: null,
  attachments: [],
  ...extra,
})
export const conversation = (id = 12, extra = {}) => ({
  id,
  other_user: { id: 8, username: 'alex', full_name: 'Alex Friend', avatar: null },
  created_at: '2026-11-03T09:00:00',
  last_message_at: '2026-11-03T10:00:00',
  last_message: {
    id: 1,
    sender_id: 8,
    content: 'Message 1',
    created_at: '2026-11-03T10:00:00',
    has_attachments: false,
  },
  unread_count: 1,
  can_send: true,
  ...extra,
})
export const incomingEvent = (id, conversationId = 12, senderId = 8) => ({
  type: 'new_message',
  data: {
    message_id: id,
    conversation_id: conversationId,
    sender_id: senderId,
    created_at: '2026-11-03T10:00:00Z',
  },
})
