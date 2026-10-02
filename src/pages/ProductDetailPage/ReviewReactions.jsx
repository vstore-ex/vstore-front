import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context'
import { reactToReview } from '../../api/reviews'
import helpfulIcon from '../../assets/product-helpful.svg'

const REACTION_CONFIGS = [
  { type: 'helpful', label: 'Helpful', icon: helpfulIcon },
  { type: 'funny', label: 'Funny' }
]

export default function ReviewReactions({ review, onSignIn, onChange, onRefresh, disabled }) {
  const { isAuthenticated, currentUser } = useAuth()
  const own = isAuthenticated && currentUser?.id != null && String(currentUser.id) === String(review.user_id)
  const [prevUserReaction, setPrevUserReaction] = useState(review.user_reaction)
  const [activeReaction, setActiveReaction] = useState(review.user_reaction || null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const lifetime = useRef(null)

  if (review.user_reaction !== prevUserReaction) {
    setPrevUserReaction(review.user_reaction)
    setActiveReaction(review.user_reaction || null)
  }

  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => controller.abort() }, [])

  async function vote(type) {
    if (own || submitting.current || disabled) return
    if (!isAuthenticated) { onSignIn?.(); return }
    const signal = lifetime.current.signal
    submitting.current = true; setBusy(true); setMessage(''); setError('')
    try {
      const result = await reactToReview(review.id, type, signal)
      if (signal.aborted) return
      const selected = ['vote added', 'reaction added'].includes(result?.message) ? true : ['vote removed', 'reaction removed'].includes(result?.message) ? false : undefined
      const nextReaction = selected ? (result?.reaction || type) : null
      setActiveReaction(nextReaction)

      if (result?.reactions_count && typeof result.reactions_count === 'object') {
        const counts = { ...result.reactions_count }
        onChange(review.id, {
          reactions_count: counts,
          user_reaction: nextReaction,
          ...Object.fromEntries(Object.entries(counts).map(([k, v]) => [k + '_count', v]))
        })
      } else {
        const prevReaction = activeReaction
        const updatedCounts = { ...(review.reactions_count || {}) }
        if (selected) {
          if (prevReaction && prevReaction !== type) {
            const prevCount = updatedCounts[prevReaction] ?? review[prevReaction + '_count'] ?? 0
            updatedCounts[prevReaction] = Math.max(0, prevCount - 1)
          }
          const currentCount = updatedCounts[type] ?? review[type + '_count'] ?? 0
          updatedCounts[type] = currentCount + 1
        } else {
          const currentCount = updatedCounts[type] ?? review[type + '_count'] ?? 0
          updatedCounts[type] = Math.max(0, currentCount - 1)
        }
        onChange(review.id, {
          reactions_count: updatedCounts,
          user_reaction: nextReaction,
          ...Object.fromEntries(Object.entries(updatedCounts).map(([k, v]) => [k + '_count', v]))
        })
        if (onRefresh && Object.keys(updatedCounts).length === 0) await onRefresh()
      }
      if (!signal.aborted) {
        const item = REACTION_CONFIGS.find(c => c.type === type)
        const label = item?.label || type
        setMessage('Your ' + label.toLowerCase() + ' reaction was ' + (selected === false ? 'removed.' : 'saved.'))
      }
    } catch (reason) { if (!signal.aborted) setError(reason.message || 'Could not save your reaction. Please try again.') }
    finally { if (!signal.aborted) { submitting.current = false; setBusy(false) } }
  }
  return <>
    <div className="review-card__reactions" aria-label="Review reactions">
      {REACTION_CONFIGS.map(({ type, label, icon }) => {
        const count = review.reactions_count?.[type] ?? review[type + '_count']
        return (
          <button type="button" key={type} disabled={own || busy || disabled}
            title={own ? 'You cannot react to your own review.' : undefined} aria-label={'Mark review as ' + label}
            aria-pressed={own ? undefined : activeReaction === type} onClick={() => vote(type)}>
            {icon && <img src={icon} alt="" />}{label}
            <span>{count == null ? '\u2014' : count.toLocaleString('en')}</span>
          </button>
        )
      })}
    </div>
    {message && <p className="review-feedback" role="status">{message}</p>}
    {error && <p className="review-feedback" role="alert">{error}</p>}
  </>
}
