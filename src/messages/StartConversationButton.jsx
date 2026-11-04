import { useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context'
import { messageError, openConversation } from '../api/messages'

function StartConversation({ userId }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)
  useLayoutEffect(() => () => request.current?.abort(), [])
  async function start() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const conversation = await openConversation(userId, controller.signal)
      if (!controller.signal.aborted) window.location.hash = '#/messages/' + conversation.id
    } catch (reason) {
      if (!controller.signal.aborted) setError(messageError(reason))
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  return (
    <div>
      <button type="button" className="button button--secondary" disabled={busy} onClick={start}>
        {busy ? 'Opening conversation...' : 'Message'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
export default function StartConversationButton({ userId }) {
  const { currentUser, isAuthenticated } = useAuth()
  return isAuthenticated && currentUser?.id && String(currentUser.id) !== String(userId) ? (
    <StartConversation key={currentUser.id + ':' + userId} userId={userId} />
  ) : null
}
