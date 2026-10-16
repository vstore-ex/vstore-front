import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context'
import { useCart } from '../cart/context'
import { WishlistContext } from './context'
import * as api from '../api/wishlist'
import { useCurrency } from '../currency/context'
function WishlistSession({ owner, orderVersion, children }) {
  const { code, switching, unavailable, refreshWallet } = useCurrency()
  const [loadedCurrency, setLoadedCurrency] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(owner != null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const active = useRef(false), lock = useRef(false), version = useRef(0)
  const refresh = useCallback(() => {
    if (owner == null || !code) return
    const request = ++version.current
    return api.getWishlist().then(data => {
      if (data.some(item => item.currency !== code)) throw new Error('Wishlist prices do not match your wallet currency. Refresh your wallet and wishlist.')
      if (active.current && request === version.current) { setItems(data); setLoadedCurrency(code); setError('') }
    }).catch(reason => {
      if (active.current && request === version.current) setError(api.wishlistError(reason))
    }).finally(() => { if (active.current && request === version.current) setLoading(false) })
  }, [owner, code])
  useEffect(() => {
    active.current = true
    refresh()
    const sync = () => { if (owner != null && !lock.current) { setLoading(true); refresh() } }
    window.addEventListener('focus', sync)
    return () => { active.current = false; version.current += 1; window.removeEventListener('focus', sync) }
  }, [owner, refresh])
  useEffect(() => {
    if (owner == null || !orderVersion) return
    refresh()
  }, [orderVersion, refresh, owner])
  async function mutate(action) {
    if (owner == null) throw new Error('Please sign in to use your wishlist.')
    if (lock.current) return false
    lock.current = true; version.current += 1; setBusy(true); setError('')
    try {
      await action()
      if (!active.current) return false
      await refresh()
      return active.current
    } catch (reason) {
      if (active.current) {
        if ([400, 404].includes(reason.status)) await refresh()
        if (active.current) setError(api.wishlistError(reason))
      }
      throw reason
    } finally { lock.current = false; if (active.current) { setBusy(false); setLoading(false) } }
  }
  const current = loadedCurrency === code && !switching
  return <WishlistContext.Provider value={{ items: current ? items : [], count: items.length,
    loading: !unavailable && (loading || (owner != null && !current && !error)), error: unavailable || error, busy,
    refresh: () => { setLoading(true); refreshWallet(); return refresh() },
    add: id => mutate(() => api.addToWishlist(id)), remove: id => mutate(() => api.removeFromWishlist(id)),
  }}>{children}</WishlistContext.Provider>
}
export default function WishlistProvider({ children }) {
  const { currentUser } = useAuth()
  const { orderVersion } = useCart()
  return <WishlistSession key={currentUser?.id ?? 'guest'} owner={currentUser?.id} orderVersion={orderVersion}>{children}</WishlistSession>
}
