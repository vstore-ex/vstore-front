import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  deleteMessage,
  editMessage,
  getConversation,
  getMessage,
  getMessages,
  markConversationRead,
  mergeMessages,
  messageError,
  sendMessage,
} from '../api/messages'
import { useNotifications } from '../notifications/context'

const initial = {
  conversation: null,
  items: [],
  cursor: null,
  loading: true,
  olderLoading: false,
  sending: false,
  reading: false,
  error: '',
  olderError: '',
  sendError: '',
  readError: '',
  editError: '',
}

export default function useConversation(id, owner, onInboxUpdate) {
  const [state, setState] = useState(initial)
  const current = useRef(initial)
  const active = useRef(false)
  const requests = useRef({ load: null, older: null, send: null, read: null, mutations: new Set() })
  const { subscribeMessages, clearMessageNotificationsFrom } = useNotifications()
  const update = useCallback((change) => {
    if (!active.current) return
    current.current = change(current.current)
    setState(current.current)
  }, [])
  const abortAll = useCallback(() => {
    for (const key of ['load', 'older', 'send', 'read']) {
      requests.current[key]?.abort()
      requests.current[key] = null
    }
    for (const controller of requests.current.mutations) controller.abort()
    requests.current.mutations.clear()
  }, [])
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
      abortAll()
    }
  }, [abortAll])
  const fail = useCallback(
    (error, field) => {
      if ([401, 403, 404].includes(error.status)) {
        abortAll()
        update(() => ({ ...initial, loading: false, error: messageError(error) }))
      } else update((old) => ({ ...old, [field]: messageError(error) }))
    },
    [abortAll, update],
  )

  const markRead = useCallback(
    async function markVisibleRead() {
      const snapshot = current.current
      if (
        !active.current ||
        document.visibilityState === 'hidden' ||
        !snapshot.conversation ||
        requests.current.read
      )
        return
      if (
        !snapshot.conversation.unread_count &&
        !snapshot.items.some((item) => item.sender.id !== owner && !item.read_at)
      )
        return
      const controller = new AbortController()
      requests.current.read = controller
      const through = snapshot.items.at(-1)?.id || 0
      update((old) => ({ ...old, reading: true, readError: '' }))
      let success = false
      try {
        await markConversationRead(id, controller.signal)
        if (controller.signal.aborted || !active.current) return
        const readAt = new Date().toISOString()
        update((old) => ({
          ...old,
          conversation: { ...old.conversation, unread_count: 0 },
          items: old.items.map((item) =>
            item.id <= through && item.sender.id !== owner
              ? { ...item, read_at: item.read_at || readAt }
              : item,
          ),
        }))
        void onInboxUpdate()
        success = true
      } catch (error) {
        if (!controller.signal.aborted && active.current) fail(error, 'readError')
      } finally {
        if (requests.current.read === controller) requests.current.read = null
        if (!controller.signal.aborted) update((old) => ({ ...old, reading: false }))
      }
      // A second event can arrive while the first read request is in flight.
      if (
        success &&
        active.current &&
        current.current.items.some(
          (item) => item.id > through && item.sender.id !== owner && !item.read_at,
        )
      )
        void markVisibleRead()
    },
    [id, owner, fail, onInboxUpdate, update],
  )

  const refresh = useCallback(async () => {
    if (!active.current) return
    requests.current.load?.abort()
    const controller = new AbortController()
    requests.current.load = controller
    const previousLastId = current.current.items.at(-1)?.id
    update((old) => ({ ...old, loading: true, error: '' }))
    try {
      const [conversation, newest] = await Promise.all([
        getConversation(id, controller.signal),
        getMessages(id, {}, controller.signal),
      ])
      let items = newest.items
      let cursor = newest.next_before_id
      // Backfill a reconnect gap; appending only the newest page would silently lose messages.
      while (previousLastId && cursor && items.length && items[0].id > previousLastId) {
        const older = await getMessages(id, { before_id: cursor }, controller.signal)
        items = mergeMessages(older.items, items)
        cursor = older.next_before_id
      }
      if (controller.signal.aborted || !active.current) return
      if (items.some((item) => ![owner, conversation.other_user.id].includes(item.sender.id)))
        throw new Error('Could not verify message participants. Please refresh.')
      update((old) => ({
        ...old,
        conversation,
        items: mergeMessages(old.items, items),
        cursor: old.items.length ? old.cursor : cursor,
        loading: false,
      }))
      void markRead()
    } catch (error) {
      if (!controller.signal.aborted && active.current) fail(error, 'error')
    } finally {
      if (requests.current.load === controller) requests.current.load = null
      if (!controller.signal.aborted) update((old) => ({ ...old, loading: false }))
    }
  }, [id, owner, markRead, fail, update])

  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    const senderId = state.conversation?.other_user.id
    if (senderId) void clearMessageNotificationsFrom(senderId)
  }, [clearMessageNotificationsFrom, state.conversation?.other_user.id])
  useEffect(
    () =>
      subscribeMessages((event) => {
        if (
          (event.type === 'new_message' && event.data.conversation_id === Number(id)) ||
          event.type === 'resume' ||
          (event.type === 'connected' && event.reconnected)
        ) {
          void refresh()
          if (
            event.type === 'new_message' &&
            event.data.sender_id === current.current.conversation?.other_user.id
          )
            void clearMessageNotificationsFrom(event.data.sender_id)
        }
        if (
          (event.type === 'message_updated' || event.type === 'message_deleted') &&
          event.data.conversation_id === Number(id)
        ) {
          if (!event.data.message_id) {
            void refresh()
            return
          }
          void (async () => {
            const controller = new AbortController()
            try {
              const item = await getMessage(id, event.data.message_id, controller.signal)
              if (controller.signal.aborted || !active.current) return
              update((old) => ({ ...old, items: mergeMessages(old.items, [item]) }))
            } catch {
              if (!controller.signal.aborted && active.current) void refresh()
            }
          })()
        }
      }),
    [clearMessageNotificationsFrom, id, refresh, subscribeMessages, update],
  )

  async function older() {
    const cursor = current.current.cursor
    if (!active.current || !cursor || requests.current.older) return
    const controller = new AbortController()
    requests.current.older = controller
    update((old) => ({ ...old, olderLoading: true, olderError: '' }))
    try {
      const page = await getMessages(id, { before_id: cursor }, controller.signal)
      if (controller.signal.aborted || !active.current) return
      update((old) => ({
        ...old,
        items: mergeMessages(old.items, page.items),
        cursor: page.next_before_id,
      }))
    } catch (error) {
      if (!controller.signal.aborted && active.current) fail(error, 'olderError')
    } finally {
      if (requests.current.older === controller) requests.current.older = null
      if (!controller.signal.aborted) update((old) => ({ ...old, olderLoading: false }))
    }
  }
  async function send(content, files = []) {
    if (
      !active.current ||
      requests.current.send ||
      !current.current.conversation?.can_send ||
      current.current.loading ||
      current.current.error ||
      (!content.trim() && !files.length)
    )
      return false
    const controller = new AbortController()
    requests.current.send = controller
    update((old) => ({ ...old, sending: true, sendError: '' }))
    try {
      const item = await sendMessage(id, content, controller.signal, files)
      if (controller.signal.aborted || !active.current) return false
      if (item.sender.id !== owner)
        throw new Error('Could not confirm the sender. Refresh before retrying.')
      update((old) => ({ ...old, items: mergeMessages(old.items, [item]) }))
      void onInboxUpdate()
      return true
    } catch (error) {
      if (!controller.signal.aborted && active.current) fail(error, 'sendError')
      return false
    } finally {
      if (requests.current.send === controller) requests.current.send = null
      if (!controller.signal.aborted) update((old) => ({ ...old, sending: false }))
    }
  }
  async function changeMessage(messageId, action, content = '') {
    if (!active.current || !current.current.conversation) return false
    const controller = new AbortController()
    requests.current.mutations.add(controller)
    update((old) => ({ ...old, editError: '' }))
    try {
      const item = await action(id, messageId, content, controller.signal)
      if (controller.signal.aborted || !active.current) return false
      update((old) => ({ ...old, items: mergeMessages(old.items, [item]) }))
      void onInboxUpdate()
      return true
    } catch (error) {
      if (!controller.signal.aborted && active.current)
        update((old) => ({ ...old, editError: messageError(error) }))
      return false
    } finally {
      requests.current.mutations.delete(controller)
    }
  }
  const edit = (messageId, content) => changeMessage(messageId, editMessage, content)
  const remove = (messageId) =>
    changeMessage(messageId, (conversationId, target, _content, signal) =>
      deleteMessage(conversationId, target, signal),
    )
  return { ...state, refresh, older, send, markRead, edit, remove }
}
