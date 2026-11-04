import { useCallback, useEffect, useRef, useState } from 'react'
import { getConversations, messageError } from '../api/messages'
import { useNotifications } from '../notifications/context'

export default function useInbox() {
  const [state, setState] = useState({
    items: [],
    page: 0,
    retryPage: 0,
    loading: true,
    error: '',
    more: false,
  })
  const request = useRef(null)
  const pageRef = useRef(0)
  const { subscribeMessages } = useNotifications()
  const load = useCallback(async (page = pageRef.current) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    // Live/read updates must follow the user's requested page, including an in-flight change.
    pageRef.current = page
    setState((old) => ({ ...old, loading: true, error: '', retryPage: page }))
    try {
      const items = await getConversations({ skip: page * 20, limit: 20 }, controller.signal)
      if (controller.signal.aborted) return
      setState({
        items: [...new Map(items.map((item) => [item.id, item])).values()],
        page,
        retryPage: page,
        loading: false,
        error: '',
        more: items.length === 20,
      })
    } catch (error) {
      if (!controller.signal.aborted)
        setState((old) => ({
          ...old,
          items: [401, 403].includes(error.status) ? [] : old.items,
          loading: false,
          error: messageError(error),
        }))
    }
  }, [])
  useEffect(() => {
    void load()
    return () => request.current?.abort()
  }, [load])
  useEffect(
    () =>
      subscribeMessages((event) => {
        if (
          event.type === 'new_message' ||
          event.type === 'resume' ||
          (event.type === 'connected' && event.reconnected)
        )
          void load()
      }),
    [load, subscribeMessages],
  )
  return { ...state, load }
}
