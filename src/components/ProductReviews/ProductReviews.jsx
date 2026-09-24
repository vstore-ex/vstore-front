import { useState } from 'react'
import MarkdownView from '../Markdown/MarkdownView'
import ContentStatus from '../Markdown/ContentStatus'
import usePublicContent from '../../hooks/usePublicContent'
export default function ProductReviews({ gameId }) {
  const [page, setPage] = useState(0)
  const resource = usePublicContent(`/games/${gameId}/reviews?skip=${page * 20}&limit=21`)
  const reviews = Array.isArray(resource.data) ? resource.data : []
  return <section className="detail-section product-reviews"><h2>Player reviews</h2>
    <ContentStatus resource={resource} />
    {!resource.loading && !resource.error && !reviews.length && <p>No reviews yet.</p>}
    {reviews.slice(0, 20).map(review => <article key={review.id}><h3>{review.username}</h3>
      <p>{review.is_positive ? 'Recommended' : 'Not recommended'}</p><MarkdownView>{review.content_md}</MarkdownView></article>)}
    <nav className="content-pagination" aria-label="Review pages"><button disabled={page === 0 || resource.loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={resource.loading || reviews.length <= 20} onClick={() => setPage(p => p + 1)}>Next</button></nav>
  </section>
}
