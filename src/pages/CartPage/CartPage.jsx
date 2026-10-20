import { useEffect, useRef, useState } from 'react'
import { useCart } from '../../cart/context'
import { cartError, formatMoney } from '../../api/cart'
import { moneyCents } from '../../api/wallet'
import { useWallet } from '../../wallet/context'
import TopUpDialog from '../../wallet/TopUpDialog'
import Dialog from '../../components/Dialog/Dialog'
import './CartPage.css'
function Totals({ cart }) {
  return <dl className="server-cart-totals">{[['Subtotal', cart.subtotal], ['Tax', cart.tax], ['Total', cart.total]].map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{cart.pricesReady ? formatMoney(value, cart.currency) : cart.error ? 'Unavailable' : 'Updating...'}</dd></div>)}</dl>
}
function Checkout({ cart, onClose, onSuccess }) {
  const wallet = useWallet()
  const [method, setMethod] = useState('card')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const { refresh } = wallet
  useEffect(() => { refresh() }, [refresh])
  const balance = moneyCents(wallet.data?.balance)
  const total = moneyCents(cart.total)
  const insufficient = balance != null && total != null && balance < total
  const differentCurrency = wallet.data && wallet.data.currency !== cart.currency
  const walletBlocked = wallet.loading || wallet.busy || !!wallet.error || !wallet.data || wallet.data.is_frozen || differentCurrency || insufficient || total == null
  async function placeOrder(event) {
    event.preventDefault()
    if (cart.busy || cart.loading || cart.error || !accepted || (method === 'wallet' && walletBlocked)) return
    setError('')
    try { const order = await cart.checkout(method, accepted); if (order) onSuccess(order) }
    catch (reason) { setError(cartError(reason)) }
  }
  return <><Dialog className="server-checkout" labelledBy="checkout-title" busy={cart.busy} onClose={onClose}>
    <form onSubmit={placeOrder}><h2 id="checkout-title">Checkout</h2>
      <ul>{cart.items.map(item => <li key={item.game_id}>{item.title} - {cart.pricesReady ? formatMoney(item.price, cart.currency) : 'Updating...'}</li>)}</ul>
      <Totals cart={cart} />
      <fieldset className="checkout-payment" disabled={cart.busy}><legend>Payment method</legend>
        <label><input type="radio" name="payment_method" value="card" checked={method === 'card'} onChange={() => { setMethod('card'); setError('') }} />Bank card</label>
        <label><input type="radio" name="payment_method" value="wallet" checked={method === 'wallet'} onChange={() => { setMethod('wallet'); setError('') }} />Wallet balance</label>
      </fieldset>
      {method === 'wallet' && <div className="checkout-wallet">
        {wallet.loading && <p role="status">Updating balance...</p>}
        {wallet.data && <p>Available balance: {formatMoney(wallet.data.balance, wallet.data.currency)}</p>}
        {wallet.error && <div role="alert"><p>{wallet.error}</p><button type="button" disabled={wallet.loading || wallet.busy || cart.busy} onClick={wallet.refresh}>Refresh balance</button></div>}
        {wallet.data?.is_frozen && <p role="alert">Your wallet is frozen. Choose a bank card or contact support.</p>}
        {differentCurrency && <div role="alert"><p>Your cart currency has changed. Refresh the cart before paying.</p><button type="button" disabled={cart.loading || cart.busy} onClick={cart.refresh}>Refresh cart</button></div>}
        {!differentCurrency && insufficient && <p role="alert">Insufficient wallet funds. You need {formatMoney((total - balance) / 100, cart.currency)} more.</p>}
        <button type="button" className="button button--secondary" disabled={cart.busy || wallet.loading || wallet.busy || !!wallet.error || !wallet.data || wallet.data.is_frozen} onClick={() => setTopUpOpen(true)}>Top up wallet</button>
      </div>}
      <label className="server-checkout-terms"><input type="checkbox" checked={accepted} disabled={cart.busy} onChange={e => setAccepted(e.target.checked)} />I accept the purchase terms.</label>
      {error && <p role="alert">{error}</p>}
      {cart.error && <div role="alert">{!error && <p>{cart.error}</p>}<button type="button" className="button button--secondary" disabled={cart.busy || cart.loading} onClick={cart.refresh}>Refresh cart to retry</button></div>}
      <div className="server-cart-actions"><button className="button button--secondary" type="button" disabled={cart.busy} onClick={onClose}>Cancel</button>
        <button className="button button--accent" type="submit" disabled={!accepted || cart.busy || cart.loading || !!cart.error || !cart.count || (method === 'wallet' && walletBlocked)}>{cart.busy ? 'Placing order...' : 'Place Order'}</button></div>
    </form>
  </Dialog>{topUpOpen && <TopUpDialog onClose={() => setTopUpOpen(false)} />}</>
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
    if (!id || !id.trim()) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/cart')
    cart.addToCart(id.trim()).catch(() => { /* The cart context displays the error. */ })
  }, [cart])
  function run(action) { action().catch(() => { /* The cart context displays the error. */ }) }
  if (order) return <div className="cart-page"><section className="cart-page__inner" role="status">
    <h1>Order #{order.id}</h1><p>Your order has been created.</p><p>{formatMoney(order.total, order.currency)}</p>
    <a className="button button--accent" href="#/account">View order history</a>
    <a className="button button--secondary" href="#/discover">Continue shopping</a>
  </section></div>
  return <div className="cart-page server-cart"><div className="cart-page__inner">
    <div className="cart-page__header"><h1>My Cart</h1><span>{cart.count} items</span></div>
    {cart.loading && <p role="status">Loading cart...</p>}
    {cart.error && <div role="alert"><p>{cart.error}</p><button className="button button--secondary" disabled={cart.busy || cart.loading} onClick={cart.refresh}>Retry cart</button></div>}
    {!cart.loading && !cart.error && !cart.count && <section className="cart-empty"><h2>Your cart is empty</h2><a href="#/discover">Browse the catalog</a></section>}
    {!!cart.count && <div className="cart-layout"><section className="cart-items" aria-label="Cart items">
      {cart.items.map(item => <article className="cart-item server-cart-item" key={item.game_id}>
        <div className="cart-item__info"><h2><a href={`#/games/${item.game_id}`}>{item.title}</a></h2></div>
        <div className="cart-item__side"><strong>{cart.pricesReady ? formatMoney(item.price, cart.currency) : cart.error ? 'Price unavailable' : 'Updating...'}</strong>
          <button type="button" disabled={cart.busy || cart.loading} onClick={() => run(() => cart.removeFromCart(item.game_id))}>Remove</button></div>
      </article>)}
      <button className="button button--secondary" disabled={cart.busy || cart.loading} onClick={() => run(cart.clearCart)}>Clear cart</button>
    </section><aside className="cart-summary" aria-label="Cart summary"><Totals cart={cart} />
      <button type="button" disabled={cart.busy || cart.loading || !!cart.error} onClick={() => setCheckoutOpen(true)}>Check Out</button>
    </aside></div>}
  </div>{checkoutOpen && <Checkout cart={cart} onClose={() => setCheckoutOpen(false)} onSuccess={created => { setCheckoutOpen(false); setOrder(created) }} />}</div>
}
