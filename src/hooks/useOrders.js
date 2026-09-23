import { useEffect, useState } from 'react'
import { getOrders } from '../api/cart'
import { useCart } from '../cart/context'
import { useAuth } from '../auth/context'
export default function useOrders() {
  const { currentUser } = useAuth()
  const { orderVersion, lastOrder } = useCart()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  const owner = currentUser?.id
  useEffect(() => {
    if (owner == null) return
    const controller = new AbortController()
    getOrders(controller.signal).then(data => {
      if (!Array.isArray(data)) throw new Error('The server returned an invalid order history.')
      if (!controller.signal.aborted) setResult({ owner, orderVersion, attempt, data })
    }).catch(error => { if (!controller.signal.aborted) setResult({ owner, orderVersion, attempt, error: error.message }) })
    return () => controller.abort()
  }, [owner, orderVersion, attempt])
  const current = result?.owner === owner && result?.orderVersion === orderVersion && result?.attempt === attempt
  const data = current ? result.data || [] : []
  const orders = lastOrder ? [lastOrder, ...data.filter(order => order.id !== lastOrder.id)] : data
  return { data: orders, loading: !current, error: current ? result.error : '', retry: () => setAttempt(v => v + 1) }
}
