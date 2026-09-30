import { useEffect, useState } from 'react'
import useCatalogResource from '../../hooks/useCatalogResource'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import NewsCard from '../../components/News/NewsCard'
const PAGE_SIZE = 12
function readFilters() {
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  const requestedPage = Number(query.get('page'))
  return { page: Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage < 1000000 ? requestedPage : 1,
    gameId: /^\d+$/.test(query.get('game_id') || '') ? query.get('game_id') : '' }
}
export default function NewsPage() {
  const [filters, setFilters] = useState(readFilters)
  useEffect(() => {
    const sync = () => setFilters(readFilters())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const resource = useCatalogResource('news', JSON.stringify({ skip: (filters.page - 1) * PAGE_SIZE, limit: PAGE_SIZE + 1, game_id: filters.gameId }))
  function navigate(page) {
    const query = new URLSearchParams({ page: String(page) })
    if (filters.gameId) query.set('game_id', filters.gameId)
    window.location.hash = '#/news?' + query
  }
  return <div className="news-page"><div className="news-page__inner">
    <h1>{filters.gameId ? 'Game news & updates' : 'News'}</h1>
    {filters.gameId && <a className="news-back" href="#/news">All news</a>}
    <div className="news-status"><ResourceStatus resource={resource} label="news" /></div>
    {resource.data && (resource.data.length ? <div className="news-grid">{resource.data.slice(0, PAGE_SIZE).map(item => <NewsCard key={item.id} item={item} />)}</div>
      : <p role="status">No news yet.</p>)}
    {(filters.page > 1 || resource.data?.length > PAGE_SIZE) && <nav className="news-pagination" aria-label="News pages">
      <button type="button" disabled={filters.page === 1 || resource.loading} onClick={() => navigate(filters.page - 1)}>Previous</button>
      <span aria-current="page">{filters.page}</span>
      <button type="button" disabled={resource.loading || !resource.data || resource.data.length <= PAGE_SIZE} onClick={() => navigate(filters.page + 1)}>Next</button>
    </nav>}
  </div></div>
}
