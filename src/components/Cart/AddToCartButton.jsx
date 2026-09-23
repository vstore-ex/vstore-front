import { useState } from 'react'
import { useAuth } from '../../auth/context'
import { useCart } from '../../cart/context'
import { cartError } from '../../api/cart'
export default function AddToCartButton({ productId, className = 'button button--secondary' }) {
  const { isAuthenticated } = useAuth()
  const { addToCart, busy } = useCart()
  const [error, setError] = useState('')
  async function add() {
    if (!isAuthenticated) {
      window.location.hash = '#/login?next=' + encodeURIComponent('cart?add=' + productId)
      return
    }
    setError('')
    try { const added = await addToCart(productId); if (added) window.location.hash = '#/cart' }
    catch (reason) { setError(cartError(reason)) }
  }
  return <div className="add-to-cart-control"><button type="button" className={className} disabled={busy} onClick={add}>Add to cart</button>
    {error && <p className="cart-action-error" role="alert">{error}</p>}</div>
}
