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
  const [votes, setVotes] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const lifetime = useRef(null)
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
      if (selected !== undefined) {
        setVotes(previous => ({
          ...(selected ? {} : previous),
          [type]: selected
        }))
      }
      if (result?.reactions_count && typeof result.reactions_count === 'object') {
        const counts = { ...result.reactions_count }
        onChange(review.id, {
          reactions_count: counts,
          ...Object.fromEntries(Object.entries(counts).map(([k, v]) => [k + '_count', v]))
        })
      } else {
        const counts = Object.fromEntries(['helpful_count', 'funny_count'].filter(key => Number.isSafeInteger(result?.[key]) && result[key] >= 0).map(key => [key, result[key]]))
        if (Object.hasOwn(counts, type + '_count')) onChange(review.id, counts)
        else if (selected !== undefined && review[type + '_count'] != null) onChange(review.id, { [type + '_count']: Math.max(0, review[type + '_count'] + (selected ? 1 : -1)) })
        else await onRefresh()
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
            aria-pressed={own ? undefined : votes[type]} onClick={() => vote(type)}>
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
