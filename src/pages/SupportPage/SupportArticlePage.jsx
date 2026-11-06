import useCatalogResource from '../../hooks/useCatalogResource'
import { ProductMarkdown } from '../ProductDetailPage/ProductContent'
import './SupportPage.css'

export default function SupportArticlePage({ id }) {
  const resource = useCatalogResource('supportArticle', String(id))
  return (
    <div className="support-page">
      <div className="support-page__inner">
        <a className="button button--secondary" href="#/support">
          Back to support
        </a>
        {resource.loading && <p role="status">Loading article…</p>}
        {resource.error?.status === 404 ? (
          <h1>Article not found</h1>
        ) : resource.error ? (
          <div role="alert">
            <p>{resource.error.message}</p>
            <button className="button button--secondary" onClick={resource.retry}>
              Retry article
            </button>
          </div>
        ) : (
          resource.data && (
            <article className="support-article">
              <p>{resource.data.category}</p>
              <h1>{resource.data.title}</h1>
              <ProductMarkdown>{resource.data.content_md}</ProductMarkdown>
            </article>
          )
        )}
      </div>
    </div>
  )
}
