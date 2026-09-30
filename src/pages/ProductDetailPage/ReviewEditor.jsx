import { useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
export default function ReviewEditor({ gameId, review, onSaved, onCancel }) {
  const [text, setText] = useState(review?.content_md || '')
  const [positive, setPositive] = useState(review?.is_positive ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (submitting.current || !text.trim()) return
    submitting.current = true; setBusy(true); setError('')
    try {
      const saved = await apiRequest(review ? '/reviews/' + encodeURIComponent(review.id) : '/games/' + encodeURIComponent(gameId) + '/reviews', {
        method: review ? 'PATCH' : 'POST', body: { content_md: text.trim(), is_positive: positive },
      })
      if (saved?.id == null) throw new Error('The server did not confirm the saved review. Please check your reviews before retrying.')
      onSaved()
    } catch (reason) {
      setError(reason.status === 403 && !review && !reason.banned ? 'You must own this game to post a review.' :
        reason.message === 'already reviewed' ? 'You already reviewed this game. Find your review below to edit it.' : reason.message)
    } finally { submitting.current = false; setBusy(false) }
  }
  return <form className="review-editor" onSubmit={submit}>
    <label>Your review<textarea value={text} onChange={event => setText(event.target.value)} required maxLength={10000} rows={5} disabled={busy} /></label>
    <label className="review-editor__recommend"><input type="checkbox" checked={positive} onChange={event => setPositive(event.target.checked)} disabled={busy} />I recommend this game</label>
    <div className="review-editor__actions"><button className="product-action product-action--accent" disabled={busy || !text.trim()} type="submit">{busy ? 'Saving...' : review ? 'Save changes' : 'Post review'}</button>
      <button className="product-text-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
    {error && <p role="alert">{error}</p>}
  </form>
}
