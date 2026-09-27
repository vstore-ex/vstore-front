import { useState } from 'react'
import useCatalogResource from '../../hooks/useCatalogResource'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { useAuth } from '../../auth/context'
import { voteHelpful } from '../../api/product'
import { ProductMarkdown, ExpandableContent } from './ProductContent'
import positiveIcon from '../../assets/review-like-positive.svg'
import negativeIcon from '../../assets/review-like-negative.svg'
import helpfulIcon from '../../assets/product-helpful.svg'

function ReviewCard({ review }) {
  const { isAuthenticated } = useAuth()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function vote() {
    if (!isAuthenticated) { setMessage('Sign in to mark this review as helpful.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await voteHelpful(review.id)
      setMessage(result?.message === 'vote removed' ? 'Your helpful vote was removed.' : 'Your helpful vote was saved.')
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
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
        <button type="button" disabled={busy} onClick={vote} aria-label="Mark review as helpful"><img src={helpfulIcon} alt="" /></button>
      </div>
      {message && <p className="review-feedback" role="status">{message}</p>}
      {error && <p className="review-feedback" role="alert">{error}</p>}
    </div>
  </article>
}

export default function ProductReviews({ id, summary }) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('recent')
  const resource = useCatalogResource('reviews', JSON.stringify({ id, page, pageSize: 6 }))
  const reviews = [...(resource.data?.items || [])].sort((a, b) =>
    (new Date(b.created_at) - new Date(a.created_at)) * (sort === 'recent' ? 1 : -1))
  return <section className="detail-section product-reviews">
    <div className="reviews-header"><h2>Customer reviews</h2>
      {summary && <p className="reviews-score">Review score: <strong>{summary.label}</strong> ({summary.count.toLocaleString('en')} reviews)</p>}
      <label className="reviews-sort">Sort this page:
        <select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recent</option><option value="oldest">Oldest</option></select>
      </label>
    </div>
    <ResourceStatus resource={resource} label="reviews" />
    {resource.data && (!reviews.length ? <p className="product-empty">No reviews yet.</p> : <>
      <div className="review-grid">{[0, 1].map(column => <div className="review-column" key={column}>
        {reviews.filter((_, index) => index % 2 === column).map(review => <ReviewCard key={review.id} review={review} />)}
      </div>)}</div>
    </>)}
    {(page > 1 || resource.data?.hasNext) && <nav className="product-pagination" aria-label="Review pages">
      <button type="button" disabled={page === 1 || resource.loading} onClick={() => setPage(value => value - 1)}>Previous</button>
      <span aria-current="page">{page}</span>
      <button type="button" disabled={!resource.data?.hasNext || resource.loading} onClick={() => setPage(value => value + 1)}>Next</button>
    </nav>}
  </section>
}
