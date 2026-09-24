import { useState } from 'react'
import MarkdownView from '../../components/Markdown/MarkdownView'
import ContentStatus from '../../components/Markdown/ContentStatus'
import usePublicContent from '../../hooks/usePublicContent'
export default function NewsDetailPage({ id }) {
  const [page, setPage] = useState(0)
  const resource = usePublicContent(id ? `/news/${encodeURIComponent(id)}` : `/news?skip=${page * 20}&limit=21`)
  const items = Array.isArray(resource.data) ? resource.data : []
  return <div className="content-page"><h1>{id ? resource.data?.title || 'News' : 'News'}</h1>
    <ContentStatus resource={resource} />
    {id ? <><a href="#/news">All news</a><MarkdownView>{resource.data?.content_md}</MarkdownView></> : <>
      {!resource.loading && !resource.error && !items.length && <p>No news yet.</p>}
      {items.slice(0,20).map(item => <article key={item.id}><h2><a href={`#/news/${item.id}`}>{item.title}</a></h2></article>)}
      <nav className="content-pagination" aria-label="News pages"><button disabled={!page || resource.loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={resource.loading || items.length <= 20} onClick={() => setPage(p => p + 1)}>Next</button></nav>
    </>}
  </div>
}
