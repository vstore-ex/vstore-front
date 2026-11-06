import { useAuth } from '../../auth/context'
import useCatalogResource from '../../hooks/useCatalogResource'
import useDocumentTitle, { pageTitle } from '../../hooks/useDocumentTitle'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { MediaImage } from '../../components/Catalog/Media'
import fallbackAvatar from '../../assets/avatar.webp'
import ProfileFriendAction from './ProfileFriendAction'
import ProfileBlockAction from './ProfileBlockAction'
import './UserProfilePage.css'

/**
 * Public profile laid out like a Steam profile: a header band with the avatar
 * frame and identity, a main column of showcases, and a side column with the
 * status and profile counters. Only data the API provides is shown.
 */

const SHOWCASE_SIZE = 8
const ACTIVITY_GAMES = 3

function formatDate(value, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en', options) : ''
}

function ProfileDate({ value, prefix }) {
  const label = formatDate(value)
  return label ? (
    <span>
      {prefix} <time dateTime={value}>{label}</time>
    </span>
  ) : null
}

function Avatar({ user }) {
  return (
    <img
      key={user.avatar}
      className="public-profile-avatar"
      src={user.avatar || fallbackAvatar}
      alt=""
      onError={(event) => {
        if (!event.currentTarget.dataset.fallback) {
          event.currentTarget.dataset.fallback = 'true'
          event.currentTarget.src = fallbackAvatar
        }
      }}
    />
  )
}

/** One "recently played"-style row: a game with the achievements unlocked in it. */
function GameActivity({ gameId, achievements }) {
  const resource = useCatalogResource('game', String(gameId))
  const game = resource.data
  const latest = achievements[0]?.unlocked_at
  const href = '#/games/' + encodeURIComponent(gameId)
  return (
    <article className="profile-activity">
      <a className="profile-activity__capsule" href={href} tabIndex={-1} aria-hidden="true">
        <MediaImage src={game?.capsuleImage} fallbackSrc={game?.heroImage} alt="" />
      </a>
      <div className="profile-activity__body">
        <h3>
          <a href={href}>{game?.title || (resource.loading ? 'Loading game…' : 'Game')}</a>
        </h3>
        <p className="profile-activity__meta">
          {achievements.length} achievement{achievements.length === 1 ? '' : 's'} unlocked
          {latest && (
            <>
              {' · '}
              <ProfileDate value={latest} prefix="last on" />
            </>
          )}
        </p>
        <ul className="profile-activity__icons" aria-label="Unlocked achievements">
          {achievements.slice(0, 10).map((item) => (
            <li key={item.id} title={item.title}>
              <MediaImage src={item.icon} alt={item.title} />
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function Showcases({ id, own }) {
  const resource = useCatalogResource('userAchievements', String(id))
  const items = resource.data || []
  const groups = []
  for (const item of items) {
    if (item.game_id == null) continue
    const group = groups.find((entry) => String(entry.gameId) === String(item.game_id))
    if (group) group.items.push(item)
    else groups.push({ gameId: item.game_id, items: [item] })
  }
  if (resource.error)
    return (
      <section className="profile-showcase" aria-labelledby="profile-achievements-title">
        <h2 id="profile-achievements-title">Achievement Showcase</h2>
        <div role="alert" className="profile-showcase__error">
          <p>Achievements are temporarily unavailable.</p>
          <button type="button" onClick={resource.retry}>
            Retry achievements
          </button>
        </div>
      </section>
    )
  return (
    <>
      <section
        id="profile-achievements"
        className="profile-showcase"
        aria-labelledby="profile-achievements-title"
      >
        <h2 id="profile-achievements-title">Achievement Showcase</h2>
        <ResourceStatus resource={resource} label="achievements" />
        {resource.data && !items.length && (
          <p className="profile-empty">
            {own
              ? 'Unlock achievements in your games and your rarest ones will be shown here.'
              : 'No achievements unlocked yet.'}
          </p>
        )}
        {!!items.length && (
          <>
            <ul className="profile-showcase__grid">
              {items.slice(0, SHOWCASE_SIZE).map((item) => (
                <li key={item.id} className="profile-achievement">
                  <MediaImage src={item.icon} alt="" className="profile-achievement__icon" />
                  <div>
                    <h3>{item.title}</h3>
                    {item.description && <p>{item.description}</p>}
                    {item.unlocked_at && (
                      <p className="profile-achievement__date">
                        <ProfileDate value={item.unlocked_at} prefix="Unlocked" />
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {items.length > SHOWCASE_SIZE && (
              <p className="profile-showcase__more">
                +{(items.length - SHOWCASE_SIZE).toLocaleString('en')} more unlocked
              </p>
            )}
          </>
        )}
      </section>
      <section className="profile-showcase" aria-labelledby="profile-activity-title">
        <h2 id="profile-activity-title">Recent Activity</h2>
        {resource.data && !groups.length && <p className="profile-empty">No recent activity.</p>}
        {groups.slice(0, ACTIVITY_GAMES).map((group) => (
          <GameActivity key={group.gameId} gameId={group.gameId} achievements={group.items} />
        ))}
      </section>
    </>
  )
}

function ProfileActions({ user, own, onSignIn }) {
  const { currentUser, isAuthenticated, status } = useAuth()
  if (own)
    return (
      <a className="profile-edit" href="#/account">
        Edit Profile
      </a>
    )
  if (isAuthenticated && currentUser?.id != null && status === 'authenticated')
    return (
      <>
        <ProfileFriendAction
          key={currentUser.id + ':' + user.id}
          userId={currentUser.id}
          profileId={user.id}
        />
        <ProfileBlockAction
          key={'block:' + currentUser.id + ':' + user.id}
          profileId={user.id}
          initiallyBlocked={user.is_blocked_by_viewer}
        />
      </>
    )
  if (status === 'loading') return <p role="status">Loading account...</p>
  return (
    <button type="button" onClick={onSignIn}>
      Sign in to add friend
    </button>
  )
}

function scrollToAchievements(event) {
  // The router owns the hash, so scroll to the showcase without changing the route.
  const target = document.getElementById('profile-achievements')
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function ProfileSidebar({ user, own }) {
  const counters = [
    { key: 'games', label: 'Games', href: own ? '#/library' : null },
    { key: 'achievements', label: 'Achievements', href: `#/users/${user.id}`, scroll: true },
    { key: 'wishlist', label: 'Wishlist', href: own ? '#/wishlist' : null },
  ]
  return (
    <aside className="profile-sidebar" aria-label="Profile summary">
      {own && <p className="profile-status profile-status--online">Currently Online</p>}
      <dl className="public-profile-stats">
        {counters.map(({ key, label, href, scroll }) => {
          const value =
            user.stats[key] == null ? 'Unavailable' : user.stats[key].toLocaleString('en')
          return (
            <div key={key}>
              <dt>
                {href ? (
                  <a href={href} onClick={scroll ? scrollToAchievements : undefined}>
                    {label}
                  </a>
                ) : (
                  label
                )}
              </dt>
              <dd>{value}</dd>
            </div>
          )
        })}
      </dl>
      {own && (
        <nav className="profile-sidebar__links" aria-label="Your profile">
          <a href="#/account">Friends</a>
          <a href="#/messages">Messages</a>
          <a href="#/wallet">Wallet</a>
        </nav>
      )}
    </aside>
  )
}

export default function UserProfilePage({ id, onSignIn }) {
  const resource = useCatalogResource('userProfile', String(id))
  const { currentUser, isAuthenticated } = useAuth()
  const user = resource.data
  useDocumentTitle(pageTitle(user ? `@${user.username}` : 'Profile'))
  const own = isAuthenticated && String(currentUser?.id) === String(user?.id)
  if (!user)
    return (
      <div className="user-profile-page">
        <div className="user-profile-inner">
          {resource.error?.status === 404 ? (
            <section role="status" className="profile-missing">
              <h1>User not found</h1>
              <p>This profile is unavailable or has been removed.</p>
              <a href="#/discover">Back to store</a>
            </section>
          ) : (
            <ResourceStatus resource={resource} label="user profile" />
          )}
        </div>
      </div>
    )
  return (
    <div className="user-profile-page">
      <header className="profile-hero">
        <div className="user-profile-inner profile-hero__inner">
          <div className="profile-avatar-frame">
            <Avatar user={user} />
          </div>
          <div className="public-profile-identity">
            <h1>@{user.username}</h1>
            {user.full_name && <p className="profile-real-name">{user.full_name}</p>}
            <p className="profile-facts">
              <span className="profile-role">{user.role_name || 'Member'}</span>
              <span className="profile-user-id">ID: {user.id}</span>
              <ProfileDate value={user.created_at} prefix="Member since" />
            </p>
          </div>
          <div className="profile-hero__actions">
            <ProfileActions user={user} own={own} onSignIn={onSignIn} />
          </div>
        </div>
      </header>
      <div className="user-profile-inner profile-content">
        <div className="profile-main">
          <Showcases id={user.id} own={own} />
        </div>
        <ProfileSidebar user={user} own={own} />
      </div>
    </div>
  )
}
