import useCatalogResource from '../../hooks/useCatalogResource'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import NewsCard from '../../components/News/NewsCard'
export default function ProductNews({ id }) {
  const resource = useCatalogResource('news', JSON.stringify({ game_id: id, limit: 3 }))
  if (resource.data?.length === 0) return null
  return <section className="detail-section product-news" aria-label="News and updates">
    <h2>News &amp; Updates</h2>
    <ResourceStatus resource={resource} label="game news" />
    {resource.data && <div className="news-grid">{resource.data.map(item => <NewsCard key={item.id} item={item} />)}</div>}
  </section>
}
