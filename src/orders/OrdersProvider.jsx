import { useEffect, useState } from 'react'
import { getOrders } from '../api/cart'
import { useCart } from '../cart/context'
import { useAuth } from '../auth/context'
import { OrdersContext } from './context'

function OrdersSession({ owner, children }) {
  const { orderVersion, lastOrder } = useCart()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  useEffect(() => {
    if (owner == null) return
    const controller = new AbortController()
    getOrders(controller.signal)
      .then((data) => {
        if (!Array.isArray(data) || data.some((order) => !order || !Array.isArray(order.items))) {
          throw new Error('The server returned an invalid order history.')
        }
        if (!controller.signal.aborted) setResult({ owner, orderVersion, attempt, data })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            owner,
            orderVersion,
            attempt,
            data: previous?.data,
            error: error.message,
          }))
      })
    return () => controller.abort()
  }, [owner, orderVersion, attempt])
  const current =
    result?.owner === owner && result?.orderVersion === orderVersion && result?.attempt === attempt
  // Keep confirmed purchases visible during refreshes and recoverable failures.
  // The keyed session below discards this history when the signed-in user changes.
  const data = owner != null ? result?.data || [] : []
  // Prefer authoritative order status, including refunds, once the server returns it.
  const orders =
    owner != null && lastOrder && !data.some((order) => order.id === lastOrder.id)
      ? [lastOrder, ...data]
      : data
  const ownedIds = [
    ...new Set(
      orders
        .filter((order) => order.status === 'paid')
        .flatMap((order) => order.items)
        .filter((item) => item?.game_id != null)
        .map((item) => String(item.game_id)),
    ),
  ]
  return (
    <OrdersContext.Provider
      value={{
        data: orders,
        ownedIds,
        loading: owner != null && !current,
        error: current ? result.error : '',
        retry: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </OrdersContext.Provider>
  )
}

export default function OrdersProvider({ children }) {
  const { currentUser } = useAuth()
  return (
    <OrdersSession key={currentUser?.id ?? 'guest'} owner={currentUser?.id}>
      {children}
    </OrdersSession>
  )
}
