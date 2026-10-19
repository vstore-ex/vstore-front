import { useEffect, useRef, useState } from 'react'
import {
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  removeFriend,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  sendFriendRequest,
  friendError,
} from '../api/friends'
const loaders = {
  friends: getFriends,
  incoming: getIncomingRequests,
  outgoing: getOutgoingRequests,
}
const initial = () =>
  Object.fromEntries(
    Object.keys(loaders).map((key) => [key, { items: [], loading: true, error: '' }]),
  )
async function fetchLists(signal) {
  const keys = Object.keys(loaders)
  const results = await Promise.allSettled(keys.map((key) => loaders[key](signal)))
  return Object.fromEntries(keys.map((key, index) => [key, results[index]]))
}
function applyResults(previous, results) {
  return Object.fromEntries(
    Object.entries(results).map(([key, result]) => [
      key,
      {
        items: result.status === 'fulfilled' ? result.value : previous[key].items,
        loading: false,
        error: result.status === 'rejected' ? friendError(result.reason) : '',
      },
    ]),
  )
}
export default function useFriends(userId) {
  const [groups, setGroups] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const lifetime = useRef(null)
  const locked = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    fetchLists(controller.signal).then((results) => {
      if (!controller.signal.aborted) setGroups((previous) => applyResults(previous, results))
    })
    return () => controller.abort()
  }, [userId])
  const loading = Object.values(groups).some((group) => group.loading)
  async function reconcile(signal) {
    const results = await fetchLists(signal)
    if (!signal.aborted) setGroups((previous) => applyResults(previous, results))
  }
  async function refresh() {
    if (locked.current || loading) return
    locked.current = true
    setBusy(true)
    const signal = lifetime.current.signal
    setGroups((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([key, group]) => [
          key,
          { ...group, loading: true, error: '' },
        ]),
      ),
    )
    try {
      await reconcile(signal)
    } finally {
      if (!signal.aborted) {
        locked.current = false
        setBusy(false)
      }
    }
  }
  async function act(action, item) {
    if (locked.current || loading) return false
    const signal = lifetime.current.signal
    locked.current = true
    setBusy(true)
    setError('')
    setMessage('')
    const snapshot = groups
    setGroups((previous) => {
      const next = { ...previous }
      if (action === 'accept') {
        next.incoming = {
          ...previous.incoming,
          items: previous.incoming.items.filter((value) => value.id !== item.id),
        }
        if (item.sender)
          next.friends = {
            ...previous.friends,
            items: [
              ...previous.friends.items.filter(
                (value) => String(value.id) !== String(item.sender.id),
              ),
              item.sender,
            ],
          }
      } else {
        const key = action === 'remove' ? 'friends' : action === 'decline' ? 'incoming' : 'outgoing'
        next[key] = {
          ...previous[key],
          items: previous[key].items.filter((value) => value.id !== item.id),
        }
      }
      return next
    })
    try {
      const operations = {
        accept: acceptFriendRequest,
        decline: declineFriendRequest,
        cancel: cancelFriendRequest,
        remove: removeFriend,
      }
      await operations[action](item.id, signal)
      if (signal.aborted) return false
      setMessage(
        {
          accept: 'Friend request accepted.',
          decline: 'Friend request declined.',
          cancel: 'Friend request cancelled.',
          remove: 'Friend removed.',
        }[action],
      )
      await reconcile(signal)
      return true
    } catch (reason) {
      if (!signal.aborted) {
        setGroups(snapshot)
        setError(friendError(reason))
        if ([400, 404].includes(reason.status)) await reconcile(signal)
      }
      return false
    } finally {
      if (!signal.aborted) {
        locked.current = false
        setBusy(false)
      }
    }
  }
  async function send(value) {
    if (locked.current || loading) return false
    const id = Number(value)
    setError('')
    setMessage('')
    if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(id) || id < 1) {
      setError('Enter a valid positive user ID.')
      return false
    }
    if (id === Number(userId)) {
      setError('You cannot add yourself.')
      return false
    }
    if (groups.friends.items.some((user) => Number(user.id) === id)) {
      setError('This user is already your friend.')
      return false
    }
    if (groups.outgoing.items.some((item) => Number(item.receiver_id) === id)) {
      setError('You have already sent this user a request.')
      return false
    }
    const signal = lifetime.current.signal
    locked.current = true
    setBusy(true)
    try {
      const request = await sendFriendRequest(id, signal)
      if (signal.aborted) return false
      setMessage(request.status === 'accepted' ? 'You are now friends.' : 'Friend request sent.')
      await reconcile(signal)
      return true
    } catch (reason) {
      if (!signal.aborted) {
        setError(friendError(reason))
        if ([400, 404].includes(reason.status)) await reconcile(signal)
      }
      return false
    } finally {
      if (!signal.aborted) {
        locked.current = false
        setBusy(false)
      }
    }
  }
  return { groups, busy: busy || loading, error, message, refresh, act, send }
}
