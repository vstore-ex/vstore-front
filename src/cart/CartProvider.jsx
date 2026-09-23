import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context'
import { CartContext } from './context'
import * as api from '../api/cart'
const emptyCart = { items: [], subtotal: '0.00', tax: '0.00', total: '0.00', currency: 'UAH' }
function CartSession({ owner, children }) {
  const [cart, setCart] = useState(emptyCart)
  const [loading, setLoading] = useState(owner != null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [orderVersion, setOrderVersion] = useState(0)
  const [lastOrder, setLastOrder] = useState(null)
  const active = useRef(false)
  const lock = useRef(false)
  const requestVersion = useRef(0)
  const refresh = useCallback(() => {
    if (owner == null) return
    const version = ++requestVersion.current
    return api.getCart().then(data => {
      if (!data || !Array.isArray(data.items) || !data.currency || ['subtotal', 'tax', 'total'].some(key => !Number.isFinite(Number(data[key])))) throw new Error('The server returned an invalid cart.')
      if (active.current && version === requestVersion.current) { setCart(data); setError('') }
    }).catch(reason => {
      if (active.current && version === requestVersion.current) setError(api.cartError(reason))
    }).finally(() => { if (active.current && version === requestVersion.current) setLoading(false) })
  }, [owner])
  useEffect(() => {
    active.current = true
    refresh()
    const sync = () => { if (owner != null && !lock.current) { setLoading(true); refresh() } }
    window.addEventListener('focus', sync)
    return () => { active.current = false; requestVersion.current += 1; window.removeEventListener('focus', sync) }
  }, [refresh, owner])
  async function mutate(action, checkout = false) {
    if (owner == null) throw new Error('Please sign in to use your cart.')
    if (lock.current) throw new Error('Please wait for the current cart action to finish.')
    lock.current = true; requestVersion.current += 1; setBusy(true); setError('')
    try {
      const result = await action()
      if (!active.current) return null
      if (checkout) {
        if (result?.id == null) throw new Error('The server did not return an order number. Check your order history before trying again.')
        setCart({ ...emptyCart, currency: cart.currency }); setLoading(false)
        setLastOrder({ ...result, currency: cart.currency }); setOrderVersion(v => v + 1)
      } else await refresh()
      return result ?? true
    } catch (reason) {
      if (active.current) {
        // Reconcile changes made by another tab/device, without discarding a failed checkout's cart.
        if ([400, 404].includes(reason.status)) await refresh()
        if (active.current) setError(api.cartError(reason))
      }
      throw reason
    } finally { lock.current = false; if (active.current) { setBusy(false); setLoading(false) } }
  }
  return <CartContext.Provider value={{ ...cart, count: cart.items.length, loading, error, busy, refresh: () => { setLoading(true); return refresh() },
    lastOrder, orderVersion, addToCart: id => mutate(() => api.addToCart(id)),
    removeFromCart: id => mutate(() => api.removeFromCart(id)), clearCart: () => mutate(api.clearCart),
    checkout: (method, termsAccepted = false) => {
      if (!termsAccepted) return Promise.reject(new Error('Please accept the purchase terms.'))
      return mutate(() => api.createOrder(method, termsAccepted), true)
    } }}>{children}</CartContext.Provider>
}
export default function CartProvider({ children }) {
  const { currentUser } = useAuth()
  return <CartSession key={currentUser?.id ?? 'guest'} owner={currentUser?.id}>{children}</CartSession>
}
