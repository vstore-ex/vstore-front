import { useState } from 'react'
import { useAuth } from '../../auth/context'
import { useCart } from '../../cart/context'
import useOrders from '../../hooks/useOrders'
import { cartError } from '../../api/cart'

function AddAction({ gameId, className, isAuthenticated, cart, orders }) {
  const [error, setError] = useState('')
  const checkingLibrary = isAuthenticated && orders.loading
  const libraryError = isAuthenticated && orders.error
  async function add() {
    if (!isAuthenticated) {
      window.location.hash = '#/login?next=' + encodeURIComponent('cart?add=' + gameId)
      return
    }
    if (cart.busy || checkingLibrary || libraryError) return
    setError('')
    try {
      const added = await cart.addToCart(gameId)
      if (added) window.location.hash = '#/cart'
    } catch (reason) {
      setError(cartError(reason))
    }
  }
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={cart.busy || checkingLibrary || !!libraryError}
        onClick={add}
      >
        {checkingLibrary ? 'Checking library...' : 'Add to cart'}
      </button>
      {libraryError ? (
        <div className="add-to-cart-control__status" role="alert">
          <span>Could not check your library.</span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              setError('')
              orders.retry()
            }}
          >
            Retry
          </button>
        </div>
      ) : !checkingLibrary && error ? (
        <p className="add-to-cart-control__status cart-action-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  )
}

export default function AddToCartButton({ gameId, className = 'button button--secondary' }) {
  const { isAuthenticated, currentUser } = useAuth()
  const cart = useCart()
  const orders = useOrders()
  const owned = isAuthenticated && orders.ownedIds.includes(String(gameId))
  const inCart =
    isAuthenticated && cart.items?.some((item) => String(item.game_id) === String(gameId))
  return (
    <div className={'add-to-cart-control' + (owned ? ' add-to-cart-control--owned' : '')}>
      {owned || inCart ? (
        <>
          <a className={className} href={owned ? '#/library' : '#/cart'}>
            {owned ? 'View library' : 'View cart'}
          </a>
          <span className="add-to-cart-control__status">
            {owned ? 'In your library' : 'In your cart'}
          </span>
        </>
      ) : (
        <AddAction
          key={gameId + ':' + (currentUser?.id ?? 'guest')}
          gameId={gameId}
          className={className}
          isAuthenticated={isAuthenticated}
          cart={cart}
          orders={orders}
        />
      )}
    </div>
  )
}
