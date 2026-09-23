import { useState } from 'react'
import { useAuth } from '../../auth/context'
import { useWishlist } from '../../wishlist/context'
import { wishlistError } from '../../api/wishlist'
export default function WishlistButton({ productId, className = 'button button--secondary' }) {
  const { isAuthenticated } = useAuth()
  const wishlist = useWishlist()
  const [error, setError] = useState('')
  const saved = wishlist.items.some(item => item.id === String(productId))
  async function add() {
    if (!isAuthenticated) { window.location.hash = '#/login?next=' + encodeURIComponent('wishlist?add=' + productId); return }
    setError('')
    try { if (await wishlist.add(productId)) window.location.hash = '#/wishlist' }
    catch (reason) { setError(wishlistError(reason)) }
  }
  if (saved) return <a className={className} href="#/wishlist">In your wishlist</a>
  return <div className="wishlist-control"><button className={className} disabled={wishlist.busy || wishlist.loading} onClick={add}>Wishlist</button>
    {error && <p role="alert">{error}</p>}</div>
}
