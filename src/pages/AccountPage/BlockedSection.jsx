import { useEffect, useState } from 'react'
import UserLink from '../../components/User/UserLink'
import fallbackAvatar from '../../assets/avatar.webp'
import { getBlockedUsers, unblockUser } from '../../api/users'
import './FriendsSection.css'

export default function BlockedSection() {
  const [attempt, setAttempt] = useState(0)
  const [items, setItems] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    getBlockedUsers(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return
        setItems(data)
        setError('')
        setStatus('ready')
      },
      (reason) => {
        if (controller.signal.aborted) return
        setError(reason?.message || 'Could not load the blocked list.')
        setStatus('error')
      },
    )
    return () => controller.abort()
  }, [attempt])
  async function remove(id) {
    setBusy(true)
    setError('')
    try {
      await unblockUser(id)
      setItems((current) => current.filter((item) => item.id !== id))
      setItems((current) => (current.length ? current : null))
    } catch (reason) {
      setError(reason?.message || 'Could not unblock this user.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="account-section">
      <h2>Blocked users</h2>
      <p>Blocked users cannot message you, and their content is hidden from your lists.</p>
      {status === 'loading' && <p role="status">Loading blocked users...</p>}
      {status === 'error' && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {status === 'ready' && !items?.length && <p>No blocked users.</p>}
      {status === 'ready' && !!items?.length && (
        <ul className="friends-list" aria-label="Blocked users">
          {items.map((item) => (
            <li key={item.id} className="blocked-user">
              <UserLink id={item.id} className="friend-profile">
                <img
                  src={item.avatar || fallbackAvatar}
                  alt=""
                  onError={(event) => {
                    if (!event.currentTarget.dataset.fallback) {
                      event.currentTarget.dataset.fallback = 'true'
                      event.currentTarget.src = fallbackAvatar
                    }
                  }}
                />
                <span>
                  <strong>{item.username}</strong>
                  {item.full_name && <small>{item.full_name}</small>}
                </span>
              </UserLink>
              <button type="button" disabled={busy} onClick={() => void remove(item.id)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && status !== 'error' && <p role="alert">{error}</p>}
    </section>
  )
}
