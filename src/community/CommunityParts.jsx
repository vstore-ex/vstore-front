import UserLink from '../components/User/UserLink'
import { communityError } from '../api/community'

export function Author({ item }) {
  return (
    <p className="community-meta">
      <UserLink id={item.author_id}>{item.username}</UserLink>
      {item.created_at && (
        <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time>
      )}
    </p>
  )
}
export function CommunityError({ error, retry, disabled }) {
  return error ? (
    <div className="community-error" role="alert">
      <p>{communityError(error)}</p>
      {retry && (
        <button type="button" disabled={disabled} onClick={retry}>
          Retry
        </button>
      )}
    </div>
  ) : null
}
export function DeleteConfirmation({ busy, onConfirm, onCancel, label }) {
  return (
    <div className="community-confirm" role="group" aria-label={'Delete ' + label + '?'}>
      <p>Delete this {label}? This cannot be undone.</p>
      <button type="button" disabled={busy} onClick={onConfirm}>
        Confirm deletion
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancel deletion
      </button>
    </div>
  )
}
