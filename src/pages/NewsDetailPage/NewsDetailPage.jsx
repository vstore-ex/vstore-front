import useCatalogResource from '../../hooks/useCatalogResource'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { MediaImage } from '../../components/Catalog/Media'
import { ProductMarkdown } from '../ProductDetailPage/ProductContent'
import { NewsDate } from '../../components/News/NewsCard'
export default function NewsDetailPage({ id }) {
  const resource = useCatalogResource('newsDetail', String(id))
  const item = resource.data
  return (
    <div className="news-page">
      <div className="news-page__inner">
        <a className="news-back" href="#/news">
          Back to news
        </a>
        {resource.error?.status === 404 ? (
          <section role="status">
            <h1>News not found</h1>
            <p>This news item is unavailable or has been removed.</p>
          </section>
        ) : (
          <ResourceStatus resource={resource} label="news article" />
        )}
        {item && (
          <article className="news-detail">
            <h1>{item.title}</h1>
            <NewsDate value={item.published_at} />
            <MediaImage className="news-detail__banner" src={item.banner_url} alt="" eager />
            <div className="news-body">
              <ProductMarkdown>{item.content_md}</ProductMarkdown>
            </div>
            {item.game_id != null && (
              <a className="news-game-link" href={'#/games/' + encodeURIComponent(item.game_id)}>
                {item.game_title ? 'View game: ' + item.game_title : 'View game'}
              </a>
            )}
          </article>
        )}
      </div>
    </div>
  )
}
