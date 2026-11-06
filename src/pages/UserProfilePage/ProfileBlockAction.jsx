import { useState } from 'react'
import { blockUser, unblockUser } from '../../api/users'

export default function ProfileBlockAction({ profileId, initiallyBlocked }) {
  const [blocked, setBlocked] = useState(!!initiallyBlocked)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  async function toggle(nextBlocked) {
    setBusy(true)
    setError('')
    try {
      if (nextBlocked) await blockUser(profileId)
      else await unblockUser(profileId)
      setBlocked(nextBlocked)
      setConfirm(false)
    } catch (reason) {
      setError(reason?.message || 'Action failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  if (blocked)
    return (
      <div className="profile-block" aria-busy={busy}>
        <button type="button" disabled={busy} onClick={() => toggle(false)}>
          Unblock user
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    )
  if (confirm)
    return (
      <div className="profile-block" aria-busy={busy}>
        <p role="group" aria-label="Confirm blocking">
          Block this user? They will not be able to message you, and their artworks, discussions and
          reviews will be hidden.
        </p>
        <button type="button" disabled={busy} onClick={() => toggle(true)}>
          Confirm blocking
        </button>
        <button type="button" disabled={busy} onClick={() => setConfirm(false)}>
          Keep visible
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    )
  return (
    <div className="profile-block" aria-busy={busy}>
      <button type="button" disabled={busy} onClick={() => setConfirm(true)}>
        Block user
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
