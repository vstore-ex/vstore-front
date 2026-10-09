import UserLink from '../../components/User/UserLink'
import ReviewEditor from './ReviewEditor'
import { useState } from 'react'
import useCatalogResource from '../../hooks/useCatalogResource'
import useReviews from '../../hooks/useReviews'
import { useAuth } from '../../auth/context'
import useOrders from '../../hooks/useOrders'
import ReviewReactions from './ReviewReactions'
import { ProductMarkdown, ExpandableContent } from './ProductContent'
import positiveIcon from '../../assets/review-like-positive.svg'
import negativeIcon from '../../assets/review-like-negative.svg'
import fallbackAvatar from '../../assets/avatar.webp'
function ReviewCard({ review, onSaved, onSignIn, onChange, onRefresh, loading }) {
  const { isAuthenticated, currentUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const date = new Date(review.created_at)
  const own = isAuthenticated && currentUser?.id != null && String(currentUser.id) === String(review.user_id)
  const content = <ProductMarkdown>{review.content_md}</ProductMarkdown>
  return <article className={'review-card review-card--' + (review.is_positive ? 'positive' : 'negative')}>
    <header className="review-card__head">
      <UserLink id={review.user_id} className="review-card__author-avatar"><img key={review.avatar} src={review.avatar || fallbackAvatar} alt={'Profile of ' + (review.username || 'review author')} onError={event => {
        if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = fallbackAvatar }
      }} /></UserLink>
      <div className="review-card__summary"><UserLink id={review.user_id}><strong>{review.username ? '@' + review.username : 'Review author'}</strong></UserLink>
        <span className="review-card__verdict"><img src={review.is_positive ? positiveIcon : negativeIcon} alt="" />{review.is_positive ? 'Recommended' : 'Not recommended'}</span></div>
      {review.created_at && !Number.isNaN(date.getTime()) && <time dateTime={review.created_at}>{date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</time>}
    </header>
    <div className="review-card__body">
      {review.content_md.length > 600 ? <ExpandableContent>{content}</ExpandableContent> : content}
      <ReviewReactions key={'reactions:' + (currentUser?.id ?? 'guest')} review={review} onSignIn={onSignIn} onChange={onChange} onRefresh={onRefresh} disabled={loading} />
      {own && !editing && <button type="button" disabled={loading} className="product-text-button review-edit" onClick={() => setEditing(true)}>Edit your review</button>}
      {own && editing && <ReviewEditor key={'editor:' + currentUser.id} gameId={review.game_id} review={review} onCancel={() => setEditing(false)} onSaved={saved => { setEditing(false); onSaved({ ...review, ...saved }, false) }} />}
    </div>
  </article>
}
function ReviewSummary({ id, revision }) {
  const resource = useCatalogResource('reviewSummary', JSON.stringify({ id, revision }))
  if (resource.loading) return <p className="reviews-score" role="status">Calculating review score...</p>
  if (resource.error) return <div className="reviews-score" role="alert"><span>Review summary is temporarily unavailable. </span><button className="product-text-button" type="button" onClick={resource.retry}>Retry summary</button></div>
  return <p className="reviews-score">{resource.data.total > 0 && <><strong>{resource.data.percentage}% positive</strong> &middot; </>}{resource.data.total.toLocaleString('en')} {resource.data.total === 1 ? 'review' : 'reviews'}</p>
}
function ReviewFeed({ id, isFree = false, onSignIn }) {
  const { isAuthenticated, currentUser } = useAuth()
  const orders = useOrders()
  const feed = useReviews(id, currentUser?.id ?? null)
  const [writing, setWriting] = useState(false)
  const [notice, setNotice] = useState('')
  const [reviewedBy, setReviewedBy] = useState(null)
  const [revision, setRevision] = useState(0)
  const [prevUser, setPrevUser] = useState(currentUser?.id)
  if (currentUser?.id !== prevUser) {
    setPrevUser(currentUser?.id)
    setWriting(false)
    setNotice('')
    setReviewedBy(null)
  }
  const owns = isAuthenticated && !orders?.loading && !orders?.error && orders?.ownedIds.includes(String(id))
  const canReview = isAuthenticated && (isFree || owns)
  const alreadyReviewed = isAuthenticated && (String(reviewedBy) === String(currentUser?.id) || feed.items.some(item => String(item.user_id) === String(currentUser?.id)))
  function saved(review, created) {
    feed.saved(created ? { ...review, user_id: review.user_id ?? currentUser.id, username: review.username || currentUser.username, avatar: review.avatar || currentUser.avatar, game_id: id } : review, created)
    setRevision(value => value + 1)
    if (created) { setWriting(false); setReviewedBy(currentUser.id); setNotice('Your review was posted.') }
  }
  return <section className="detail-section product-reviews" aria-labelledby="reviews-title">
    <div className="reviews-header"><h2 id="reviews-title">Customer reviews</h2><ReviewSummary id={id} revision={revision} /></div>
    <div className="review-compose">
      {!isAuthenticated && <p>Sign in to leave a review. <button className="product-text-button" type="button" onClick={onSignIn}>Sign in</button></p>}
      {alreadyReviewed ? (
        <p role="status">You already left a review for this game.</p>
      ) : canReview ? (
        <button className="product-text-button" type="button" disabled={feed.loading} onClick={() => { setWriting(value => !value); setNotice('') }}>
          Write a review
        </button>
      ) : isAuthenticated && !orders?.loading ? (
        <p role="status" style={{ opacity: 0.8, fontSize: 14 }}>You must own this game in your library to write a review.</p>
      ) : null}
      {writing && canReview && !alreadyReviewed && <ReviewEditor key={id + ':' + currentUser.id} gameId={id} onCancel={() => setWriting(false)}
        onDuplicate={() => { setReviewedBy(currentUser.id); setWriting(false) }} onSaved={review => saved(review, true)} />}
      {notice && <p role="status">{notice}</p>}
    </div>
    <div className="reviews-status">
      {feed.loading && <p role="status">{feed.items.length ? 'Loading more reviews...' : 'Loading reviews...'}</p>}
      {feed.error && <div role="alert"><p>{feed.error}</p><button className="product-text-button" type="button" disabled={feed.loading} onClick={feed.refresh}>Retry reviews</button></div>}
    </div>
    {!feed.loading && !feed.error && !feed.items.length && <p className="product-empty">No reviews for this game yet. Be the first!</p>}
    <div className="review-grid" aria-busy={feed.loading}>{feed.items.map(review => <ReviewCard key={review.id} review={review} onSignIn={onSignIn}
      onSaved={saved} onChange={feed.updateCounts} onRefresh={feed.refresh} loading={feed.loading} />)}</div>
    {feed.hasMore && <div className="product-pagination"><button type="button" disabled={feed.loading} onClick={feed.loadMore}>{feed.loading ? 'Loading...' : 'Show more reviews'}</button></div>}
  </section>
}
export default function ProductReviews(props) {
  const { currentUser } = useAuth()
  return <ReviewFeed key={props.id + ':' + (currentUser?.id ?? 'guest')} {...props} />
}
