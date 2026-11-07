import AccountAchievements from './AccountAchievements'
import WalletSection from '../../wallet/WalletSection'
import CurrencySelector from '../../currency/CurrencySelector'
import useCatalogResource from '../../hooks/useCatalogResource'
import UserLink from '../../components/User/UserLink'
import FriendsSection from './FriendsSection'
import BlockedSection from './BlockedSection'
import { useEffect, useRef, useState } from 'react'
import { mediaUrl } from '../../api/client'
import useOrders from '../../hooks/useOrders'
import { useWishlist } from '../../wishlist/context'
import { updateUser, updateAvatar } from '../../api/auth'
import fallbackAvatar from '../../assets/avatar.webp'
import EmailVerification from '../../auth/EmailVerification'
import EmailNewsSettings from './EmailNewsSettings'
import PasswordSettings from './PasswordSettings'
import './AccountPage.css'

const ACCOUNT_SECTIONS = [
  ['account-general', 'General'],
  ['account-avatar', 'Avatar'],
  ['account-security', 'Password & security'],
  ['account-notifications', 'Email notifications'],
  ['account-wallet', 'Wallet & currency'],
  ['account-achievements', 'Achievements'],
  ['account-friends', 'Friends'],
  ['account-blocked', 'Blocked users'],
  ['account-sessions', 'Sessions'],
]

export default function AccountPage(props) {
  return <AccountSession key={props.user.id} {...props} />
}

function AccountSession({
  user,
  onUpdated,
  onLogoutAll,
  onPasswordChanged,
  isLoggingOut,
  focusWallet,
}) {
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
        {/* Steam "Edit Profile" header: avatar, name › Edit Profile, back to the profile. */}
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
            <h1>
              {user.username}
              <span className="account-hero__crumb" aria-hidden="true">
                {' › '}
              </span>
              <span className="account-hero__page">Edit Profile</span>
            </h1>
            <p>{[user.fullName, user.role].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="account-hero__stats">
            {Object.entries(stats).map(([label, value]) => (
              <div className="account-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <UserLink id={user.id} className="account-hero__profile-link">
            View public profile
          </UserLink>
        </section>

        <div className="account-layout">
          <AccountNav sections={ACCOUNT_SECTIONS} />
          <div className="account-panels">
            {/* Only the fields form submits; verification buttons stay outside it. */}
            <div className="account-profile-form">
              <section
                id="account-general"
                className="account-section account-panel"
                aria-labelledby="account-general-title"
              >
                <h2 id="account-general-title">Profile settings</h2>
                <p className="account-panel__hint">
                  Your name and contact details. Your username and ID stay the same.
                </p>
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
                  id="account-profile-form"
                  className="store-form account-fields"
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
                </form>
              </section>

              {/* Not labelled by its heading: the file input below is the control named "Avatar". */}
              <section id="account-avatar" className="account-section account-panel">
                <h2 id="account-avatar-title">Avatar</h2>
                <div className="account-avatar-editor">
                  <div className="account-avatar-previews" aria-hidden="true">
                    <img className="account-avatar-preview--full" src={avatarSrc} alt="" />
                    <img className="account-avatar-preview--medium" src={avatarSrc} alt="" />
                    <img className="account-avatar-preview--small" src={avatarSrc} alt="" />
                  </div>
                  <div className="account-avatar-controls">
                    <p className="account-panel__hint">
                      Choose a square image. It is shown on your profile, in friends lists and in
                      messages.
                    </p>
                    <label className="account-avatar-choose">
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
                  </div>
                </div>
              </section>

              <div className="account-save-bar">
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
                <button
                  type="submit"
                  form="account-profile-form"
                  className="button button--accent"
                  disabled={busy}
                >
                  {busy ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            </div>

            <div id="account-security" className="account-panel-slot">
              <PasswordSettings onPasswordChanged={onPasswordChanged} />
            </div>
            <div id="account-notifications" className="account-panel-slot">
              <EmailNewsSettings />
            </div>
            <div id="account-wallet" className="account-panel-slot">
              <WalletSection focusWallet={focusWallet} />
              <CurrencySelector profile />
            </div>
            <div id="account-achievements" className="account-panel-slot">
              <AccountAchievements resource={achievements} userId={user.id} />
            </div>
            <div id="account-friends" className="account-panel-slot">
              <FriendsSection />
            </div>
            <div id="account-blocked" className="account-panel-slot">
              <BlockedSection />
            </div>
            <section
              id="account-sessions"
              className="account-section account-panel"
              aria-labelledby="account-sessions-title"
            >
              <h2 id="account-sessions-title">Session settings</h2>
              <p className="account-panel__hint">
                Signs you out everywhere, including this browser.
              </p>
              <button
                className="button button--secondary"
                disabled={isLoggingOut || busy}
                onClick={onLogoutAll}
              >
                Sign out of all devices
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Steam-style settings navigation that highlights the section in view. */
function AccountNav({ sections }) {
  const [active, setActive] = useState(sections[0][0])
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    for (const [id] of sections) {
      const node = document.getElementById(id)
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [sections])
  return (
    <nav className="account-nav" aria-label="Account settings">
      {sections.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-current={active === id ? 'true' : undefined}
          onClick={() => {
            // The router owns the URL hash, so scroll without changing it.
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setActive(id)
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
