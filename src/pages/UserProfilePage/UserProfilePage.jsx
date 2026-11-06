import { useAuth } from '../../auth/context'
import useCatalogResource from '../../hooks/useCatalogResource'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { MediaImage } from '../../components/Catalog/Media'
import fallbackAvatar from '../../assets/avatar.webp'
import ProfileFriendAction from './ProfileFriendAction'
import ProfileBlockAction from './ProfileBlockAction'
import './UserProfilePage.css'
function ProfileDate({ value, prefix }) {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? (
    <p>
      {prefix}{' '}
      <time dateTime={value}>
        {date.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
      </time>
    </p>
  ) : null
}
function Achievements({ id }) {
  const resource = useCatalogResource('userAchievements', String(id))
  return (
    <section className="profile-achievements" aria-labelledby="profile-achievements-title">
      <h2 id="profile-achievements-title">Unlocked achievements</h2>
      {resource.error ? (
        <div role="alert">
          <p>Achievements are temporarily unavailable.</p>
          <button type="button" onClick={resource.retry}>
            Retry achievements
          </button>
        </div>
      ) : (
        <ResourceStatus resource={resource} label="achievements" />
      )}
      {resource.data?.length === 0 && <p>No achievements unlocked yet.</p>}
      <div className="profile-achievements-grid">
        {resource.data?.map((item) => (
          <article className="profile-achievement" key={item.id}>
            <MediaImage src={item.icon} alt="" className="profile-achievement__icon" />
            <div>
              <h3>{item.title}</h3>
              {item.description && <p>{item.description}</p>}
              <ProfileDate value={item.unlocked_at} prefix="Unlocked" />
              {item.game_id != null && (
                <a href={'#/games/' + encodeURIComponent(item.game_id)}>View game</a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
export default function UserProfilePage({ id, onSignIn }) {
  const resource = useCatalogResource('userProfile', String(id))
  const { currentUser, isAuthenticated, status } = useAuth()
  const user = resource.data
  const own = isAuthenticated && String(currentUser?.id) === String(user?.id)
  return (
    <div className="user-profile-page">
      <div className="user-profile-inner">
        <a className="profile-back" href="#/discover">
          Back to store
        </a>
        {resource.error?.status === 404 ? (
          <section role="status">
            <h1>User not found</h1>
            <p>This profile is unavailable or has been removed.</p>
          </section>
        ) : (
          <ResourceStatus resource={resource} label="user profile" />
        )}
        {user && (
          <>
            <header className="public-profile-header">
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
              <div className="public-profile-identity">
                <span className="profile-role">{user.role_name || 'Member'}</span>
                <h1>@{user.username}</h1>
                <p className="profile-user-id">ID: {user.id}</p>
                {user.full_name && <p>{user.full_name}</p>}
                <ProfileDate value={user.created_at} prefix="Joined" />
                {own ? (
                  <a className="profile-edit" href="#/account">
                    Edit profile
                  </a>
                ) : isAuthenticated && currentUser?.id != null && status === 'authenticated' ? (
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
                ) : status === 'loading' ? (
                  <p role="status">Loading account...</p>
                ) : (
                  <button type="button" onClick={onSignIn}>
                    Sign in to add friend
                  </button>
                )}
              </div>
            </header>
            <dl className="public-profile-stats">
              {Object.entries({
                games: 'Games',
                achievements: 'Achievements',
                wishlist: 'Wishlist',
              }).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {user.stats[key] == null ? 'Unavailable' : user.stats[key].toLocaleString('en')}
                  </dd>
                </div>
              ))}
            </dl>
            <Achievements id={user.id} />
          </>
        )}
      </div>
    </div>
  )
}
