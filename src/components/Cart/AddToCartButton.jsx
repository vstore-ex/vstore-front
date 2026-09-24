import './AddToCartButton.css'
import { useState } from 'react'
import { useAuth } from '../../auth/context'
import { useCart } from '../../cart/context'
import useOrders from '../../hooks/useOrders'
import { cartError } from '../../api/cart'
export default function AddToCartButton({ productId, className = 'button button--secondary' }) {
  const { isAuthenticated } = useAuth()
  const { addToCart, busy } = useCart()
  const [error, setError] = useState('')
  const orders = useOrders()
  const owned = orders.ownedIds.includes(String(productId))
  async function add() {
    if (!isAuthenticated) {
      window.location.hash = '#/login?next=' + encodeURIComponent('cart?add=' + productId)
      return
    }
    if (owned || orders.loading) return
    setError('')
    try { const added = await addToCart(productId); if (added) window.location.hash = '#/cart' }
    catch (reason) { setError(cartError(reason)) }
  }
  if (owned) return <div className="add-to-cart-control"><span>In your library</span> <a href="#/account">View library</a></div>
  return <div className="add-to-cart-control"><button type="button" className={className} disabled={busy || (isAuthenticated && orders.loading)} onClick={add}>{isAuthenticated && orders.loading ? 'Checking library...' : 'Add to cart'}</button>
    {error && <p className="cart-action-error" role="alert">{error}</p>}</div>
}
