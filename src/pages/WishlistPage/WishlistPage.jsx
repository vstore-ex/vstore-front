import { useEffect, useRef, useState } from 'react'
import { useWishlist } from '../../wishlist/context'
import { useCart } from '../../cart/context'
import useOrders from '../../hooks/useOrders'
import { cartError } from '../../api/cart'
import { MediaImage } from '../../components/Catalog/Media'
import './WishlistPage.css'

export default function WishlistPage() {
  const wishlist = useWishlist(), cart = useCart(), orders = useOrders()
  const consumed = useRef(false), moving = useRef(false)
  const [addingId, setAddingId] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (consumed.current) return
    consumed.current = true
    const id = new URLSearchParams(window.location.hash.split('?')[1]).get('add')
    if (!id || !id.trim()) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/wishlist')
    wishlist.add(id.trim()).catch(() => { /* Context displays the error. */ })
  }, [wishlist])
  async function addToCart(id) {
    if (moving.current || orders.loading || orders.error || orders.ownedIds.includes(String(id))) return
    moving.current = true; setAddingId(id); setError('')
    try {
      const inCart = cart.items.some(item => String(item.game_id) === String(id))
      const added = inCart || await cart.addToCart(id)
      if (added) window.location.hash = '#/cart'
    } catch (reason) { setError(cartError(reason)) }
    finally { moving.current = false; setAddingId(null) }
  }
  const busy = wishlist.busy || cart.busy || addingId != null
  return <div className="wishlist-page"><div className="wishlist-page__inner">
    <div className="wishlist-page__header"><h1>My Wishlist</h1><span>{wishlist.count} games</span></div>
    {wishlist.loading && <p role="status">Loading wishlist...</p>}
    {wishlist.error && <div role="alert"><p>{wishlist.error}</p><button disabled={busy || wishlist.loading} onClick={wishlist.refresh}>Retry wishlist</button></div>}
    {error && <p role="alert">{error}</p>}
    {orders.error && <p role="alert">Could not check your library. <button onClick={orders.retry}>Retry library</button></p>}
    {!wishlist.loading && !wishlist.error && !wishlist.count && <section className="wishlist-empty"><h2>Your wishlist is empty</h2><a href="#/discover">Browse the catalog</a></section>}
    <section className="wishlist-list" aria-label="Wishlist items">{wishlist.items.map(item => <article className="wishlist-item" key={item.id}>
      <div className="wishlist-item__main"><MediaImage className="wishlist-item__cover" src={item.image} alt={item.title} />
        <div className="wishlist-item__info"><span className="wishlist-item__type">{item.type}</span><h2><a href={`#/games/${item.id}`}>{item.title}</a></h2>
          <div className="wishlist-tags">{item.tags.map(tag => <a key={tag.id} href={`#/discover?tag_id=${tag.id}`}>{tag.name}</a>)}</div>
        </div></div>
      <div className="wishlist-item__side"><strong>{item.price}</strong><div className="wishlist-item__actions">
        <button className="wishlist-item__remove" disabled={busy || wishlist.loading} onClick={() => wishlist.remove(item.id).catch(() => {})}>Remove</button>
        {orders.ownedIds.includes(String(item.id)) ? <a href="#/account">In your library</a> : <button className="wishlist-item__cart" disabled={busy || wishlist.loading || cart.loading || orders.loading || !!orders.error} onClick={() => addToCart(item.id)}>{addingId === item.id ? 'Adding...' : 'Add to cart'}</button>}
      </div></div>
    </article>)}</section>
  </div></div>
}
