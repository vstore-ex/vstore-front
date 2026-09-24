import { useEffect, useState } from 'react'
import { getOrders } from '../api/cart'
import { useCart } from '../cart/context'
import { useAuth } from '../auth/context'
import { OrdersContext } from './context'

export default function OrdersProvider({ children }) {
  const { currentUser } = useAuth()
  const { orderVersion, lastOrder } = useCart()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  const owner = currentUser?.id
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  useEffect(() => {
    if (owner == null) return
    const controller = new AbortController()
    getOrders(controller.signal).then(data => {
      if (!Array.isArray(data) || data.some(order => !order || !Array.isArray(order.items))) {
        throw new Error('The server returned an invalid order history.')
      }
      if (!controller.signal.aborted) setResult({ owner, orderVersion, attempt, data })
    }).catch(error => {
      if (!controller.signal.aborted) setResult(previous => ({ owner, orderVersion, attempt, error: error.message,
        data: previous?.owner === owner ? previous.data : undefined }))
    })
    return () => controller.abort()
  }, [owner, orderVersion, attempt])
  const current = result?.owner === owner && result?.orderVersion === orderVersion && result?.attempt === attempt
  const hasData = owner != null && result?.owner === owner && Array.isArray(result.data)
  const data = hasData ? result.data : []
  // Prefer authoritative order status, including refunds, once the server returns it.
  const orders = owner != null && lastOrder && !data.some(order => order.id === lastOrder.id) ? [lastOrder, ...data] : data
  const ownedIds = [...new Set(orders.filter(order => order.status === 'paid')
    .flatMap(order => order.items).filter(item => item?.product_id != null).map(item => String(item.product_id)))]
  return <OrdersContext.Provider value={{ data: orders, ownedIds,
    hasData, loading: owner != null && !hasData && !current,
    refreshing: owner != null && !current, error: owner != null && result?.owner === owner ? result.error : '',
    retry: () => setAttempt(value => value + 1) }}>{children}</OrdersContext.Provider>
}
