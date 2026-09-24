import { useEffect, useRef, useState } from 'react'
import { useCart } from '../../cart/context'
import { cartError, formatMoney } from '../../api/cart'
import './CartPage.css'
function Totals({ cart }) {
  return <dl className="server-cart-totals">{[['Subtotal', cart.subtotal], ['Tax', cart.tax], ['Total', cart.total]].map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{formatMoney(value, cart.currency)}</dd></div>)}</dl>
}
function Checkout({ cart, onClose, onSuccess }) {
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef(null)
  useEffect(() => { dialog.current.showModal() }, [])
  async function placeOrder(event) {
    event.preventDefault()
    if (cart.busy || !accepted) return
    setError('')
    try { const order = await cart.checkout('card', accepted); if (order) onSuccess(order) }
    catch (reason) { setError(cartError(reason)) }
  }
  return <dialog className="server-checkout" ref={dialog} aria-labelledby="checkout-title" onCancel={event => { event.preventDefault(); if (!cart.busy) onClose() }}>
    <form onSubmit={placeOrder}><h2 id="checkout-title">Checkout</h2>
      <ul>{cart.items.map(item => <li key={item.product_id}>{item.title} - {formatMoney(item.price, cart.currency)}</li>)}</ul>
      <Totals cart={cart} /><p>Payment method: Card</p>
      <label className="server-checkout-terms"><input type="checkbox" checked={accepted} disabled={cart.busy} onChange={e => setAccepted(e.target.checked)} />I accept the purchase terms.</label>
      {error && <p role="alert">{error}</p>}
      <div className="server-cart-actions"><button className="button button--secondary" type="button" disabled={cart.busy} onClick={onClose}>Cancel</button>
        <button className="button button--accent" type="submit" disabled={!accepted || cart.busy || cart.loading || !cart.count}>{cart.busy ? 'Placing order...' : 'Place Order'}</button></div>
    </form>
  </dialog>
}
export default function CartPage() {
  const cart = useCart()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [order, setOrder] = useState(null)
  const consumed = useRef(false)
  useEffect(() => {
    if (consumed.current) return
    consumed.current = true
    const params = new URLSearchParams(window.location.hash.split('?')[1])
    const id = params.get('add')
    if (!/^\d+$/.test(id || '')) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/cart')
    cart.addToCart(id).catch(() => { /* The cart context displays the error. */ })
  }, [cart])
  function run(action) { action().catch(() => { /* The cart context displays the error. */ }) }
  if (order) return <div className="cart-page"><section className="cart-page__inner" role="status">
    <h1>Order #{order.id}</h1><p>Your order has been created.</p><p>{formatMoney(order.total, cart.currency)}</p>
    <a className="button button--accent" href="#/account">View order history</a>
    <a className="button button--secondary" href="#/discover">Continue shopping</a>
  </section></div>
  return <div className="cart-page server-cart"><div className="cart-page__inner">
    <div className="cart-page__header"><h1>My Cart</h1><span>{cart.count} items</span></div>
    {cart.loading && <p role="status">Loading cart...</p>}
    {cart.error && <div role="alert"><p>{cart.error}</p><button className="button button--secondary" disabled={cart.busy || cart.loading} onClick={cart.refresh}>Retry cart</button></div>}
    {!cart.loading && !cart.error && !cart.count && <section className="cart-empty"><h2>Your cart is empty</h2><a href="#/discover">Browse the catalog</a></section>}
    {!!cart.count && <div className="cart-layout"><section className="cart-items" aria-label="Cart items">
      {cart.items.map(item => <article className="cart-item server-cart-item" key={item.product_id}>
        <div className="cart-item__info"><h2><a href={`#/products/${item.product_id}`}>{item.title}</a></h2></div>
        <div className="cart-item__side"><strong>{formatMoney(item.price, cart.currency)}</strong>
          <button type="button" disabled={cart.busy || cart.loading} onClick={() => run(() => cart.removeFromCart(item.product_id))}>Remove</button></div>
      </article>)}
      <button className="button button--secondary" disabled={cart.busy || cart.loading} onClick={() => run(cart.clearCart)}>Clear cart</button>
    </section><aside className="cart-summary" aria-label="Cart summary"><Totals cart={cart} />
      <button type="button" disabled={cart.busy || cart.loading || !!cart.error} onClick={() => setCheckoutOpen(true)}>Check Out</button>
    </aside></div>}
  </div>{checkoutOpen && <Checkout cart={cart} onClose={() => setCheckoutOpen(false)} onSuccess={created => { setCheckoutOpen(false); setOrder(created) }} />}</div>
}
