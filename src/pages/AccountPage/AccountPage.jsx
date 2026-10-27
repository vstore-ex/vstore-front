import AccountAchievements from './AccountAchievements'
import WalletSection from '../../wallet/WalletSection'
import CurrencySelector from '../../currency/CurrencySelector'
import useCatalogResource from '../../hooks/useCatalogResource'
import UserLink from '../../components/User/UserLink'
import FriendsSection from './FriendsSection'
import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from '../../api/client'
import useOrders from '../../hooks/useOrders'
import { formatMoney } from '../../api/cart'
import { useWishlist } from '../../wishlist/context'
import { updateUser, updateAvatar } from '../../api/auth'
import fallbackAvatar from '../../assets/avatar.webp'
import EmailVerification from '../../auth/EmailVerification'
import Library from './Library'
import './AccountPage.css'

export default function AccountPage(props) {
  return <AccountSession key={props.user.id} {...props} />
}

function AccountSession({ user, onUpdated, onLogoutAll, isLoggingOut, focusWallet }) {
  const [values, setValues] = useState({
    full_name: user.fullName,
    email: user.email,
    phone: user.phone || '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarTimestamp, setAvatarTimestamp] = useState(() => Date.now())
  const avatarInput = useRef(null)
  const activeSave = useRef(null)
  useEffect(() => () => activeSave.current?.abort(), [])
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])
  const achievements = useCatalogResource('userAchievements', String(user.id))
  const orders = useOrders()
  const wishlist = useWishlist()
  const stats = Object.fromEntries(
    Object.entries(user.stats || {}).filter(
      ([label]) => !['games', 'wishlist', 'achievements'].includes(label.toLowerCase()),
    ),
  )
  stats.Achievements = achievements.loading
    ? '...'
    : achievements.error
      ? 'Unavailable'
      : achievements.data.length
  stats.Games = orders.loading ? '...' : orders.error ? 'Unavailable' : orders.ownedIds.length
  stats.Wishlist = wishlist?.loading ? '...' : (wishlist?.count ?? 0)

  function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WEBP).')
      setMessage('')
      return
    }
    setError('')
    setMessage('')
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function saveProfile(includeDetails) {
    if (activeSave.current || (!includeDetails && !avatarFile)) return
    const controller = new AbortController()
    activeSave.current = controller
    const { signal } = controller
    let avatarSaved = false
    setBusy(true)
    setMessage('')
    setError('')
    try {
      if (avatarFile) {
        const updated = await updateAvatar(avatarFile, signal)
        if (signal.aborted) return
        // Each request commits independently; keep the confirmed avatar if details fail.
        onUpdated({ ...user, ...updated })
        avatarSaved = true
        setAvatarFile(null)
        setAvatarPreview(null)
        if (avatarInput.current) avatarInput.current.value = ''
        setAvatarTimestamp(Date.now())
      }
      if (includeDetails) {
        const updated = await updateUser(values, signal)
        if (signal.aborted) return
        onUpdated(updated)
        // Keep the editable email aligned with the active address, not the pending one.
        setValues((current) => ({ ...current, email: updated.email }))
      }
      setMessage(includeDetails ? 'Profile saved.' : 'Avatar saved successfully.')
    } catch (err) {
      if (!signal.aborted) {
        setError(
          err.message || (includeDetails ? 'Could not save profile.' : 'Avatar upload failed.'),
        )
        if (avatarSaved) setMessage('Your avatar was saved. Retry to save your profile details.')
      }
    } finally {
      if (activeSave.current === controller) {
        activeSave.current = null
        if (!signal.aborted) setBusy(false)
      }
    }
  }

  const avatarSrc =
    avatarPreview ||
    (() => {
      if (!user.avatar) return fallbackAvatar
      const isExternal = user.avatar.startsWith('http://') || user.avatar.startsWith('https://')
      return isExternal ? user.avatar : `${mediaUrl(user.avatar)}?t=${avatarTimestamp}`
    })()

  return (
    <div className="account-page account-page--current">
      <div className="account-page__inner">
        <UserLink id={user.id}>View public profile</UserLink>
        <section className="account-hero" aria-label="Account profile">
          <img
            className="account-hero__avatar"
            src={avatarSrc}
            alt=""
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (e.currentTarget.getAttribute('src') !== fallbackAvatar) {
                e.currentTarget.src = fallbackAvatar
              }
            }}
          />
          <div className="account-hero__identity">
            <p>{user.role}</p>
            <h1>{user.username}</h1>
            <p>{user.fullName}</p>
          </div>
          <div className="account-hero__stats">
            {Object.entries(stats).map(([label, value]) => (
              <div className="account-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
        <WalletSection focusWallet={focusWallet} />
        <CurrencySelector profile />
        <AccountAchievements resource={achievements} userId={user.id} />
        <Library />
        <FriendsSection />
        <section className="account-section">
          <h2>Profile settings</h2>
          {user.pendingEmail && (
            <div className="account-email-status">
              <p>
                Active email: <strong>{user.email}</strong>
              </p>
              <p>
                Pending email: <strong>{user.pendingEmail}</strong>
              </p>
              <p>Your email changes only after you confirm the new address.</p>
              {user.emailVerificationSent === true && (
                <p role="status">Confirmation email sent. Check your inbox.</p>
              )}
              <EmailVerification
                key={user.pendingEmail}
                email={user.pendingEmail}
                delivery={user.emailVerificationSent}
                disabled={busy}
              />
            </div>
          )}
          {!user.pendingEmail && user.emailVerified === false && (
            <EmailVerification key={user.email} email={user.email} disabled={busy} />
          )}
          <form
            className="store-form"
            onSubmit={(event) => {
              event.preventDefault()
              saveProfile(true)
            }}
          >
            {Object.entries({ full_name: 'Full name', email: 'Email', phone: 'Phone' }).map(
              ([name, label]) => (
                <label key={name}>
                  {label}
                  <input
                    type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
                    value={values[name]}
                    required={name === 'email'}
                    disabled={busy}
                    onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                  />
                </label>
              ),
            )}
            <label>
              Avatar
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={handleAvatarChange}
              />
            </label>
            {avatarFile && (
              <div className="account-avatar-upload">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => saveProfile(false)}
                >
                  {busy ? 'Uploading...' : 'Upload avatar now'}
                </button>
                <span className="account-avatar-upload__filename">({avatarFile.name})</span>
              </div>
            )}
            <button className="button button--accent" disabled={busy}>
              {busy ? 'Saving...' : 'Save profile'}
            </button>
            {error && (
              <p className="store-form__error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="store-form__status" role="status">
                {message}
              </p>
            )}
          </form>
        </section>
        <section className="account-section">
          <h2>Session settings</h2>
          <button
            className="button button--secondary"
            disabled={isLoggingOut || busy}
            onClick={onLogoutAll}
          >
            Sign out of all devices
          </button>
        </section>
        <section className="account-section">
          <h2>Orders</h2>
          {orders.loading && <p role="status">Loading orders...</p>}
          {orders.error && (
            <div role="alert">
              {orders.error}
              <button type="button" onClick={orders.retry}>
                Retry orders
              </button>
            </div>
          )}
          {!orders.loading && !orders.error && orders.data?.length === 0 && <p>No orders yet.</p>}
          <div className="order-list">
            {orders.data?.map((order) => (
              <article key={order.id}>
                <h3>Order #{order.id}</h3>
                <p>
                  {new Date(order.created_at).toLocaleDateString()} /{' '}
                  {formatMoney(order.total, order.currency)}
                </p>
                <ul>
                  {order.items.map((item) => (
                    <li key={item.game_id}>
                      <a href={`#/games/${item.game_id}`}>Game #{item.game_id}</a> /{' '}
                      {formatMoney(item.price_at_purchase, item.currency || order.currency)}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
