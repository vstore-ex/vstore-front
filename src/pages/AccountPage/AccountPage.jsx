import { useState } from 'react'
import { mediaUrl } from '../../api/client'
import useResource from '../../hooks/useResource'
import { updateUser, updateAvatar } from '../../api/auth'
const priceLabel = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
import fallbackAvatar from '../../assets/account/account-avatar.png'
import './AccountPage.css'

export default function AccountPage({ user, onUpdated, onLogoutAll, isLoggingOut }) {
  const [values, setValues] = useState({ full_name: user.fullName, email: user.email, phone: user.phone || '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const orders = useResource('/me/orders/')
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      onUpdated(await updateUser(values))
      setMessage('Profile saved.')
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  async function avatar(event) {
    const file = event.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('Choose an image file.'); return
    }
    setBusy(true); setMessage('')
    try {
      onUpdated(await updateAvatar(file))
      setMessage('Avatar saved.')
    } catch (error) { setMessage(error.message) } finally { setBusy(false); event.target.value = '' }
  }
  return <div className="account-page account-page--current"><div className="account-page__inner">
    <section className="account-hero" aria-label="Account profile">
      <img className="account-hero__avatar" src={mediaUrl(user.avatar) || fallbackAvatar} alt="" />
      <div className="account-hero__identity"><p>{user.role}</p><h1>{user.username}</h1><p>{user.fullName}</p></div>
      <div className="account-hero__stats">{Object.entries(user.stats).map(([label, value]) =>
        <div className="account-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </section>
    <section className="account-section"><h2>Profile settings</h2>
      <form className="store-form" onSubmit={save}>
        {Object.entries({ full_name: 'Full name', email: 'Email', phone: 'Phone' }).map(([name, label]) =>
          <label key={name}>{label}<input type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
            value={values[name]} required={name === 'email'} onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))} /></label>)}
        <button className="button button--accent" disabled={busy}>Save profile</button>
        <label>Avatar<input type="file" accept="image/*" disabled={busy} onChange={avatar} /></label>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
    <section className="account-section"><h2>Session settings</h2>
      <button className="button button--secondary" disabled={isLoggingOut || busy} onClick={onLogoutAll}>Sign out of all devices</button>
    </section>
    <section className="account-section"><h2>Orders</h2>
      {orders.loading && <p role="status">Loading orders...</p>}{orders.error && <p role="alert">{orders.error}</p>}
      {orders.data?.length === 0 && <p>No orders yet.</p>}
      <div className="order-list">{orders.data?.map(order => <article key={order.id}>
        <h3>Order #{order.id}</h3><p>{new Date(order.created_at).toLocaleDateString()} / {priceLabel(order.total)}</p>
        <ul>{order.items.map(item => <li key={item.product_id}>
          <a href={`#/products/${item.product_id}`}>Game #{item.product_id}</a> / {priceLabel(item.price_at_purchase)}
        </li>)}</ul>
      </article>)}</div>
    </section>
  </div></div>
}
