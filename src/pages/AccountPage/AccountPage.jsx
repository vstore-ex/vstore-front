import AccountAchievements from './AccountAchievements'
import WalletSection from '../../wallet/WalletSection'
import CurrencySelector from '../../currency/CurrencySelector'
import useCatalogResource from '../../hooks/useCatalogResource'
import UserLink from '../../components/User/UserLink'
import FriendsSection from './FriendsSection'
import { mediaUrl } from '../../api/client'
import useOrders from '../../hooks/useOrders'
import { formatMoney } from '../../api/cart'
import { useWishlist } from '../../wishlist/context'
import fallbackAvatar from '../../assets/avatar.webp'
import Library from './Library'
import './AccountPage.css'

export default function AccountPage({ user, focusWallet, focusLibrary }) {
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

  return (
    <div className="account-page account-page--current">
      <div className="account-page__inner">
        <div className="account-profile-links">
          <UserLink id={user.id}>View public profile</UserLink>
          <a className="button button--accent" href="#/account/edit">
            Edit profile
          </a>
        </div>
        <section className="account-hero" aria-label="Account profile">
          <img
            className="account-hero__avatar"
            src={mediaUrl(user.avatar) || fallbackAvatar}
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
        <Library focusLibrary={focusLibrary} />
        <FriendsSection />
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
