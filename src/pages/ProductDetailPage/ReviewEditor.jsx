import { useEffect, useId, useRef, useState } from 'react'
import { createReview, updateReview, reviewError, REVIEW_MAX_LENGTH } from '../../api/reviews'
export default function ReviewEditor({ gameId, review, onSaved, onCancel, onDuplicate }) {
  const [text, setText] = useState(review?.content_md || '')
  const [positive, setPositive] = useState(review?.is_positive ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  const submitting = useRef(false)
  const lifetime = useRef(null)
  const inputId = useId()
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])
  async function submit(event) {
    event.preventDefault()
    if (submitting.current || duplicate) return
    if (!text.trim() || text.trim().length > REVIEW_MAX_LENGTH) {
      setError('Enter a review between 1 and ' + REVIEW_MAX_LENGTH + ' characters.')
      return
    }
    const signal = lifetime.current.signal
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const payload = { content_md: text.trim(), is_positive: positive }
      const saved = await (review
        ? updateReview(review.id, payload, signal)
        : createReview(gameId, payload, signal))
      if (!signal.aborted) onSaved(saved)
    } catch (reason) {
      if (!signal.aborted) {
        setError(reviewError(reason))
        if (!review && reason.status === 400 && /already|duplicate/i.test(reason.message)) {
          setDuplicate(true)
          onDuplicate?.()
        }
      }
    } finally {
      if (!signal.aborted) {
        submitting.current = false
        setBusy(false)
      }
    }
  }
  return (
    <form className="review-editor" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || duplicate}>
        <legend>Your verdict</legend>
        <label>
          <input
            type="radio"
            name={inputId}
            checked={positive}
            onChange={() => setPositive(true)}
          />
          I recommend this game
        </label>
        <label>
          <input
            type="radio"
            name={inputId}
            checked={!positive}
            onChange={() => setPositive(false)}
          />
          I do not recommend this game
        </label>
      </fieldset>
      <label htmlFor={inputId}>Your review</label>
      <textarea
        id={inputId}
        aria-describedby={inputId + '-length'}
        value={text}
        onChange={(event) => setText(event.target.value)}
        required
        maxLength={REVIEW_MAX_LENGTH}
        rows={5}
        disabled={busy || duplicate}
      />
      <small id={inputId + '-length'}>
        {text.length.toLocaleString('en')} / {REVIEW_MAX_LENGTH.toLocaleString('en')} characters.
        Markdown supported.
      </small>
      <div className="review-editor__actions">
        <button
          className="product-action product-action--accent"
          disabled={busy || duplicate || !text.trim() || text.length > REVIEW_MAX_LENGTH}
          type="submit"
        >
          {busy ? 'Saving...' : review ? 'Save changes' : 'Post review'}
        </button>
        <button className="product-text-button" type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
