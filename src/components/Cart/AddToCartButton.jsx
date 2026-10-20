import { useState } from 'react'
import { useAuth } from '../../auth/context'
import { useCart } from '../../cart/context'
import useOrders from '../../hooks/useOrders'
import { cartError } from '../../api/cart'
export default function AddToCartButton({ gameId, className = 'button button--secondary' }) {
  const { isAuthenticated } = useAuth()
  const { addToCart, busy } = useCart()
  const [error, setError] = useState('')
  const orders = useOrders()
  const owned = orders.ownedIds.includes(String(gameId))
  async function add() {
    if (!isAuthenticated) {
      window.location.hash = '#/login?next=' + encodeURIComponent('cart?add=' + gameId)
      return
    }
    if (owned || orders.loading || orders.error) return
    setError('')
    try {
      const added = await addToCart(gameId)
      if (added) window.location.hash = '#/cart'
    } catch (reason) {
      setError(cartError(reason))
    }
  }
  if (owned)
    return (
      <div className="add-to-cart-control">
        <span>In your library</span> <a href="#/account">View library</a>
      </div>
    )
  return (
    <div className="add-to-cart-control">
      <button
        type="button"
        className={className}
        disabled={busy || (isAuthenticated && (orders.loading || !!orders.error))}
        onClick={add}
      >
        {isAuthenticated && orders.loading ? 'Checking library...' : 'Add to cart'}
      </button>
      {isAuthenticated && orders.error && (
        <p role="alert">
          Could not check your library.{' '}
          <button type="button" onClick={orders.retry}>
            Retry
          </button>
        </p>
      )}
      {error && (
        <p className="cart-action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
