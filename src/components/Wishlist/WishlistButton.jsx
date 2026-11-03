import { useState } from 'react'
import { useAuth } from '../../auth/context'
import { useWishlist } from '../../wishlist/context'
import useOrders from '../../hooks/useOrders'
import { wishlistError } from '../../api/wishlist'

export default function WishlistButton({ gameId, className = 'button button--secondary' }) {
  const { isAuthenticated } = useAuth()
  const wishlist = useWishlist()
  const orders = useOrders()
  const [error, setError] = useState('')
  const owned = orders.ownedIds.includes(String(gameId))
  const saved = wishlist.items.some((item) => item.id === String(gameId))

  async function add() {
    if (!isAuthenticated) {
      window.location.hash = '#/login?next=' + encodeURIComponent('wishlist?add=' + gameId)
      return
    }
    if (owned || orders.loading || orders.error) return
    setError('')
    try {
      if (await wishlist.add(gameId)) window.location.hash = '#/wishlist'
    } catch (reason) {
      setError(wishlistError(reason))
    }
  }

  if (owned) return null
  if (saved)
    return (
      <a className={className} href="#/wishlist">
        In your wishlist
      </a>
    )
  return (
    <div className="wishlist-control">
      <button
        type="button"
        className={className}
        disabled={
          wishlist.busy ||
          wishlist.loading ||
          (isAuthenticated && (orders.loading || !!orders.error))
        }
        onClick={add}
      >
        {isAuthenticated && orders.loading ? 'Checking library...' : 'Wishlist'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
