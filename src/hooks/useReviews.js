import { useEffect, useRef, useState } from 'react'
import { getReviews } from '../api/reviews'
const PAGE_SIZE = 6
const unique = items => {
  const seen = new Set()
  return items.filter(item => { const id = String(item.id); if (seen.has(id)) return false; seen.add(id); return true })
}
export default function useReviews(gameId, userId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [session, setSession] = useState({ gameId, userId })
  const lifetime = useRef(null)
  const cursor = useRef(0)
  const lock = useRef(false)
  const pinned = useRef([])

  if (session.gameId !== gameId || session.userId !== userId) {
    setSession({ gameId, userId })
    setItems([])
    setLoading(true)
    setError('')
  }

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller; lock.current = true; cursor.current = 0; pinned.current = []
    getReviews(gameId, { limit: PAGE_SIZE + 1 }, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setItems(data.slice(0, PAGE_SIZE)); cursor.current = Math.min(data.length, PAGE_SIZE); setHasMore(data.length > PAGE_SIZE)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) { lock.current = false; setLoading(false) } })
    return () => controller.abort()
  }, [gameId, userId])
  async function loadMore() {
    if (lock.current) return
    const signal = lifetime.current.signal
    lock.current = true; setLoading(true); setError('')
    try {
      const data = await getReviews(gameId, { skip: cursor.current, limit: PAGE_SIZE + 1 }, signal)
      if (signal.aborted) return
      cursor.current += Math.min(data.length, PAGE_SIZE)
      setItems(previous => unique([...previous, ...data.slice(0, PAGE_SIZE)])); setHasMore(data.length > PAGE_SIZE)
    } catch (reason) { if (!signal.aborted) setError(reason.message) }
    finally { if (!signal.aborted) { lock.current = false; setLoading(false) } }
  }
  async function refresh() {
    if (lock.current) return false
    const signal = lifetime.current.signal
    lock.current = true; setLoading(true); setError('')
    try {
      const length = Math.max(cursor.current, PAGE_SIZE)
      const data = []
      for (let skip = 0; skip < length + 1; skip += 100) {
        const page = await getReviews(gameId, { skip, limit: Math.min(100, length + 1 - skip) }, signal)
        data.push(...page)
        if (page.length < Math.min(100, length + 1 - skip)) break
      }
      if (signal.aborted) return false
      pinned.current = pinned.current.map(item => data.find(value => String(value.id) === String(item.id)) || item)
      setItems(unique([...pinned.current, ...data.slice(0, length)])); cursor.current = Math.min(data.length, length); setHasMore(data.length > length)
      return true
    } catch (reason) { if (!signal.aborted) setError(reason.message); return false }
    finally { if (!signal.aborted) { lock.current = false; setLoading(false) } }
  }
  function saved(review, created) {
    if (created) pinned.current = unique([review, ...pinned.current])
    else pinned.current = pinned.current.map(item => String(item.id) === String(review.id) ? review : item)
    setItems(previous => created ? unique([review, ...previous]) : previous.map(item => String(item.id) === String(review.id) ? review : item))
  }
  function updateCounts(id, counts) {
    const update = item => String(item.id) === String(id) ? { ...item, ...counts } : item
    setItems(previous => previous.map(update)); pinned.current = pinned.current.map(update)
  }
  return { items, loading, error, hasMore, loadMore, refresh, saved, updateCounts }
}
