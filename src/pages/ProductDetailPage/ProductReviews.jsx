import ReviewEditor from './ReviewEditor'
import { useRef, useState } from 'react'
import useCatalogResource from '../../hooks/useCatalogResource'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { useAuth } from '../../auth/context'
import { voteHelpful } from '../../api/product'
import { ProductMarkdown, ExpandableContent } from './ProductContent'
import positiveIcon from '../../assets/review-like-positive.svg'
import negativeIcon from '../../assets/review-like-negative.svg'
import helpfulIcon from '../../assets/product-helpful.svg'

function ReviewCard({ review, onSaved, onSignIn }) {
  const { isAuthenticated, currentUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const submitting = useRef(false)
  const [confirmedVote, setConfirmedVote] = useState(null)
  const helpful = isAuthenticated && confirmedVote?.userId === currentUser?.id ? confirmedVote.value : undefined
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function vote() {
    if (!isAuthenticated) { onSignIn?.(); return }
    if (submitting.current) return
    submitting.current = true
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await voteHelpful(review.id)
      if (['vote added', 'vote removed'].includes(result?.message)) setConfirmedVote({ userId: currentUser.id, value: result.message === 'vote added' })
      if (!['vote added', 'vote removed'].includes(result?.message)) throw new Error('Could not confirm your vote. Please try again.')
      setMessage(result.message === 'vote removed' ? 'Your helpful vote was removed.' : 'Your helpful vote was saved.')
    } catch (reason) { setError(reason.message) }
    finally { submitting.current = false; setBusy(false) }
  }
  const date = new Date(review.created_at)
  const content = <ProductMarkdown>{review.content_md}</ProductMarkdown>
  return <article className={'review-card review-card--' + (review.is_positive ? 'positive' : 'negative')}>
    <header className="review-card__head">
      <img className="review-card__icon" src={review.is_positive ? positiveIcon : negativeIcon} alt="" />
      <div className="review-card__summary"><strong>@{review.username}</strong>
        <span>{review.is_positive ? 'This user recommends this game' : 'This user doesn’t recommend this game'}</span></div>
      {!Number.isNaN(date.getTime()) && <time dateTime={review.created_at}>Posted on: {date.toLocaleDateString('en', { month: 'long', day: 'numeric' })}</time>}
    </header>
    <div className="review-card__body">
      {review.content_md?.length > 600 ? <ExpandableContent>{content}</ExpandableContent> : content}
      <div className="review-card__helpful">Was review helpful?
        <button type="button" disabled={busy} aria-pressed={helpful} onClick={vote} aria-label="Mark review as helpful"><img src={helpfulIcon} alt="" /></button>
      </div>
      {message && <p className="review-feedback" role="status">{message}</p>}
      {error && <p className="review-feedback" role="alert">{error}</p>}
      {String(currentUser?.id) === String(review.user_id) && isAuthenticated && !editing && <button type="button" className="product-text-button review-edit" onClick={() => setEditing(value => !value)}>Edit your review</button>}
      {editing && isAuthenticated && String(currentUser.id) === String(review.user_id) && <ReviewEditor key={currentUser.id} gameId={review.game_id} review={review} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved() }} />}
    </div>
  </article>
}

export default function ProductReviews({ id, summary, onSignIn }) {
  const { isAuthenticated, currentUser } = useAuth()
  const [writing, setWriting] = useState(false)
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const resource = useCatalogResource('reviews', JSON.stringify({ id, page, pageSize: 6 }), String(id))
  const reviews = resource.data?.items || []
  return <section className="detail-section product-reviews">
    <div className="reviews-header"><h2>Customer reviews</h2>
      {summary && <p className="reviews-score">Review score: <strong>{summary.label}</strong> ({summary.count.toLocaleString('en')} reviews)</p>}
    </div>
    <div className="review-compose">
      {isAuthenticated ? <button className="product-text-button" type="button" onClick={() => { setWriting(value => !value); setNotice('') }}>Write a review</button>
        : <button className="product-text-button" type="button" onClick={onSignIn}>Sign in to write a review</button>}
      {writing && isAuthenticated && <ReviewEditor key={id + ':' + currentUser.id} gameId={id} onCancel={() => setWriting(false)}
        onSaved={() => { setWriting(false); setNotice('Your review was posted.'); setPage(1); resource.retry() }} />}
      {notice && <p role="status">{notice}</p>}
    </div>
    <div className="reviews-status"><ResourceStatus resource={resource} label="reviews" /></div>
    {resource.data && (!reviews.length ? <p className="product-empty">No reviews yet.</p> : <>
      <div className="review-grid" aria-busy={resource.loading}>{[0, 1].map(column => <div className="review-column" key={column}>
        {reviews.filter((_, index) => index % 2 === column).map(review => <ReviewCard key={review.id} review={review} onSignIn={onSignIn} onSaved={resource.retry} />)}
      </div>)}</div>
    </>)}
    {(page > 1 || resource.data?.hasNext) && <nav className="product-pagination" aria-label="Review pages">
      <button type="button" disabled={page === 1 || resource.loading} onClick={() => setPage(value => value - 1)}>Previous</button>
      <span aria-current="page">{resource.data?.page || page}</span>
      <button type="button" disabled={!resource.data?.hasNext || resource.loading || !!resource.error} onClick={() => setPage(value => value + 1)}>Next</button>
    </nav>}
  </section>
}
