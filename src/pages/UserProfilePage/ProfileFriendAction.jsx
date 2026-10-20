import { useState } from 'react'
import useFriends from '../../hooks/useFriends'
import addFriendIcon from '../../assets/account/icon-add-friend.svg'
export default function ProfileFriendAction({ userId, profileId }) {
  const state = useFriends(userId)
  const [confirm, setConfirm] = useState(false)
  const matches = (id) => String(id) === String(profileId)
  const friend = state.groups.friends.items.find((item) => matches(item.id))
  const incoming = state.groups.incoming.items.find((item) => matches(item.sender_id))
  const outgoing = state.groups.outgoing.items.find((item) => matches(item.receiver_id))
  const loading = Object.values(state.groups).some((group) => group.loading)
  const unavailable = Object.values(state.groups).some((group) => group.error)
  return (
    <div className="profile-social" aria-busy={state.busy}>
      {loading ? (
        <p role="status">Loading friendship...</p>
      ) : unavailable ? (
        <div role="alert">
          <p>Could not check friendship status.</p>
          <button type="button" disabled={state.busy} onClick={state.refresh}>
            Retry friendship status
          </button>
        </div>
      ) : friend ? (
        <details
          className="profile-friend-menu"
          onToggle={(event) => {
            if (!event.currentTarget.open) setConfirm(false)
          }}
        >
          <summary>
            Friends <span aria-hidden="true">&#9662;</span>
          </summary>
          <div>
            {confirm ? (
              <div role="group" aria-label="Confirm removal">
                <p>Remove this user from your friends?</p>
                <button
                  type="button"
                  disabled={state.busy}
                  onClick={async () => {
                    if (await state.act('remove', friend)) setConfirm(false)
                  }}
                >
                  Confirm removal
                </button>
                <button type="button" disabled={state.busy} onClick={() => setConfirm(false)}>
                  Keep friend
                </button>
              </div>
            ) : (
              <button type="button" disabled={state.busy} onClick={() => setConfirm(true)}>
                Remove friend
              </button>
            )}
          </div>
        </details>
      ) : outgoing ? (
        <>
          <button type="button" disabled>
            Request sent
          </button>
          <button type="button" disabled={state.busy} onClick={() => state.act('cancel', outgoing)}>
            Cancel request
          </button>
        </>
      ) : incoming ? (
        <>
          <p>This user sent you a friend request.</p>
          <button type="button" disabled={state.busy} onClick={() => state.act('accept', incoming)}>
            Accept friend request
          </button>
          <button
            type="button"
            disabled={state.busy}
            onClick={() => state.act('decline', incoming)}
          >
            Decline
          </button>
        </>
      ) : (
        <button
          type="button"
          className="profile-add-friend"
          disabled={state.busy}
          onClick={() => state.send(String(profileId))}
        >
          <img src={addFriendIcon} alt="" />
          Add friend
        </button>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </div>
  )
}
