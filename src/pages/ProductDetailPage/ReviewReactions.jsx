import { useRef, useState } from 'react'
import { useAuth } from '../../auth/context'
import { voteReview } from '../../api/product'
import helpfulIcon from '../../assets/product-helpful.svg'

export default function ReviewReactions({ review, onSignIn }) {
  const { isAuthenticated, currentUser } = useAuth()
  const own = isAuthenticated && currentUser?.id != null && String(currentUser.id) === String(review.user_id)
  const [votes, setVotes] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  async function vote(type) {
    if (own || submitting.current) return
    if (!isAuthenticated) { onSignIn?.(); return }
    submitting.current = true; setBusy(true); setMessage(''); setError('')
    try {
      const result = await voteReview(review.id, type)
      if (!['vote added', 'vote removed'].includes(result?.message)) throw new Error('Could not confirm your reaction. Please try again.')
      const selected = result.message === 'vote added'
      setVotes(previous => ({ ...previous, [type]: { userId: currentUser.id, value: selected } }))
      setMessage('Your ' + type + ' reaction was ' + (selected ? 'saved.' : 'removed.'))
    } catch (reason) { setError(reason.message) }
    finally { submitting.current = false; setBusy(false) }
  }
  if (own) return null
  return <>
    <div className="review-card__reactions" aria-label="Review reactions">
      {['helpful', 'funny'].map(type => <button type="button" key={type} disabled={busy}
        aria-label={'Mark review as ' + type}
        aria-pressed={isAuthenticated && votes[type]?.userId === currentUser?.id ? votes[type]?.value : undefined}
        onClick={() => vote(type)}>
        {type === 'helpful' && <img src={helpfulIcon} alt="" />}
        {type === 'helpful' ? 'Helpful' : 'Funny'}
      </button>)}
    </div>
    {message && <p className="review-feedback" role="status">{message}</p>}
    {error && <p className="review-feedback" role="alert">{error}</p>}
  </>
}
