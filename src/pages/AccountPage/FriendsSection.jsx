import { useState } from 'react'
import { useAuth } from '../../auth/context'
import useFriends from '../../hooks/useFriends'
import addFriendIcon from '../../assets/account/icon-add-friend.svg'
import fallbackAvatar from '../../assets/avatar.webp'
import './FriendsSection.css'
const tabs = { friends: 'My friends', incoming: 'Incoming requests', outgoing: 'Outgoing requests' }
const empty = { friends: 'No friends yet. Send an invitation using their user ID.', incoming: 'No incoming requests.', outgoing: 'No outgoing requests.' }
function Profile({ user, id }) {
  return <div className="friend-profile">
    <img src={user?.avatar || fallbackAvatar} alt="" onError={event => {
      if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = fallbackAvatar }
    }} />
    <div><strong>{user?.username ? '@' + user.username : 'User #' + id}</strong>
      {user?.full_name && <p>{user.full_name}</p>}<small>ID: {user?.id ?? id}</small></div>
  </div>
}
function FriendsPanel({ user }) {
  const state = useFriends(user.id)
  const [tab, setTab] = useState('friends')
  const [receiver, setReceiver] = useState('')
  const [confirm, setConfirm] = useState(null)
  const group = state.groups[tab]
  async function submit(event) {
    event.preventDefault()
    if (await state.send(receiver)) setReceiver('')
  }
  function changeTab(next) { setTab(next); setConfirm(null) }
  function tabKeys(event) {
    const keys = Object.keys(tabs)
    let index = keys.indexOf(tab)
    if (event.key === 'ArrowRight') index = (index + 1) % keys.length
    else if (event.key === 'ArrowLeft') index = (index + keys.length - 1) % keys.length
    else if (event.key === 'Home') index = 0
    else if (event.key === 'End') index = keys.length - 1
    else return
    event.preventDefault(); changeTab(keys[index]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[index].focus()
  }
  return <section className="account-section friends-section" aria-labelledby="friends-heading">
    <div className="friends-heading"><h2 id="friends-heading">Friends</h2>
      <button type="button" className="button button--secondary" disabled={state.busy} onClick={state.refresh}>Refresh friends</button></div>
    <form className="friend-add-form" onSubmit={submit}>
      <label htmlFor="friend-user-id">Add a friend by user ID</label>
      <div><input id="friend-user-id" inputMode="numeric" autoComplete="off" value={receiver} onChange={event => setReceiver(event.target.value)} placeholder="User ID" maxLength={16} disabled={state.busy} required />
        <button type="submit" className="button button--accent" disabled={state.busy || !receiver.trim()}><img src={addFriendIcon} alt="" />Send request</button></div>
    </form>
    {state.error && <p className="friends-error" role="alert">{state.error}</p>}
    {state.message && <p className="friends-message" role="status">{state.message}</p>}
    <div className="friends-tabs" role="tablist" aria-label="Friends lists">
      {Object.entries(tabs).map(([key, label]) => <button key={key} id={'friends-tab-' + key} role="tab" type="button" aria-selected={tab === key}
        aria-controls={'friends-panel-' + key} tabIndex={tab === key ? 0 : -1} onKeyDown={tabKeys} onClick={() => changeTab(key)}>
        {label} <span className="friends-count">{state.groups[key].loading ? '...' : state.groups[key].error ? '?' : state.groups[key].items.length}</span>
      </button>)}
    </div>
    <div id={'friends-panel-' + tab} role="tabpanel" aria-labelledby={'friends-tab-' + tab} tabIndex={0} aria-busy={group.loading}>
      {group.loading && <p role="status">Loading {tabs[tab].toLowerCase()}...</p>}
      {group.error && <div role="alert"><p>{group.error}</p><button type="button" disabled={state.busy} onClick={state.refresh}>Retry {tabs[tab].toLowerCase()}</button></div>}
      {!group.loading && !group.error && !group.items.length && <p className="friends-empty">{empty[tab]}</p>}
      <div className="friends-list">{group.items.map(item => <article className="friend-card" key={item.id}>
        <Profile key={(tab === 'friends' ? item.avatar : item[tab === 'incoming' ? 'sender' : 'receiver']?.avatar) || item.id}
          user={tab === 'friends' ? item : item[tab === 'incoming' ? 'sender' : 'receiver']}
          id={tab === 'friends' ? item.id : item[tab === 'incoming' ? 'sender_id' : 'receiver_id']} />
        <div className="friend-actions">
          {tab === 'friends' ? confirm === item.id ? <div role="group" aria-label="Confirm removal">
            <p>Remove {item.username} from your friends?</p>
            <button type="button" disabled={state.busy} onClick={() => { setConfirm(null); state.act('remove', item) }}>Confirm removal</button>
            <button type="button" disabled={state.busy} onClick={() => setConfirm(null)}>Keep friend</button>
          </div> : <button type="button" disabled={state.busy} onClick={() => setConfirm(item.id)}>Remove friend</button>
            : tab === 'incoming' ? <>
              <button type="button" className="friend-accept" disabled={state.busy} onClick={() => state.act('accept', item)}>Accept</button>
              <button type="button" disabled={state.busy} onClick={() => state.act('decline', item)}>Decline</button>
            </> : <button type="button" disabled={state.busy} onClick={() => state.act('cancel', item)}>Cancel request</button>}
        </div>
      </article>)}</div>
    </div>
  </section>
}
export default function FriendsSection() {
  const { isAuthenticated, currentUser } = useAuth()
  return isAuthenticated && currentUser?.id != null ? <FriendsPanel key={currentUser.id} user={currentUser} /> : null
}
